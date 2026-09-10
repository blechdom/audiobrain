// @vitest-environment node
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execute = promisify(execFile);
const temporaryDirectories: string[] = [];
const fakeCurl = `#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
const isCatalog = args.some(a => a.includes('/storybook/'));
const status = isCatalog ? process.env.CATALOG_STATUS ?? '404' : process.env.ROOT_STATUS ?? '403';
const policy = isCatalog ? process.env.CATALOG_POLICY ?? 'SAMEORIGIN' : 'DENY';
const output = args[args.indexOf('--output') + 1];
writeFileSync(output, 'HTTP/2 ' + status + '\\r\\nx-frame-options: ' + policy + '\\r\\n' +
  (isCatalog ? "content-security-policy: frame-ancestors 'self'\\r\\n" : ''));
process.stdout.write(status);
`;
const fakeAws = `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2);
appendFileSync(process.env.AWS_TEST_LOG, JSON.stringify(args) + '\\n');
if (args[0] === 'sts') console.log('123456789012');
else if (args.includes('list-hosted-zones-by-name')) console.log('/hostedzone/AUDIO audiobrain.org. False');
else if (args.includes('describe-stacks')) {
  if (!process.env.EXISTING_STACK_URL) process.exit(1);
  console.log(process.env.EXISTING_STACK_URL);
} else if (args.includes('list-resource-record-sets')) console.log(process.env.EXISTING_RECORDS ?? '');
else if (args.includes('list-open-id-connect-providers')) console.log('arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com');
`;

async function fixture(): Promise<{ directory: string; env: NodeJS.ProcessEnv; log: string }> {
  const directory = await mkdtemp(join(tmpdir(), 'audiobrain-deployment-'));
  temporaryDirectories.push(directory);
  await writeFile(join(directory, 'package.json'), '{"type":"module"}');
  await writeFile(join(directory, 'curl'), fakeCurl, { mode: 0o755 });
  await writeFile(join(directory, 'aws'), fakeAws, { mode: 0o755 });
  const log = join(directory, 'aws.log');
  return {
    directory,
    log,
    env: {
      ...process.env,
      PATH: `${directory}:${process.env.PATH ?? ''}`,
      AWS_TEST_LOG: log,
      GITHUB_OIDC_SUBJECT: 'repo:blechdom/audiobrain:environment:production',
    },
  };
}

async function runScript(name: string, env: NodeJS.ProcessEnv, args: string[] = []) {
  return execute('bash', [resolve('scripts', name), ...args], { env });
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe('CloudFront publication preflight', () => {
  it.each(['200', '403', '404'])('accepts HTTP %s with the correct separate policies', async status => {
    const { env } = await fixture();
    const result = await runScript('check-cloudfront.sh', { ...env, ROOT_STATUS: status });
    expect(result.stdout).toContain('Verified CloudFront policies');
  });

  it('rejects an origin failure even when framing headers are correct', async () => {
    const { env } = await fixture();
    await expect(runScript('check-cloudfront.sh', { ...env, ROOT_STATUS: '503' }))
      .rejects.toThrow('HTTP 503');
  });

  it('rejects a catalog policy that prevents Storybook preview frames', async () => {
    const { env } = await fixture();
    await expect(runScript('check-cloudfront.sh', { ...env, CATALOG_POLICY: 'DENY' })).rejects.toThrow();
  });
});

describe('AWS bootstrap and publishing boundaries', () => {
  it('refuses existing DNS on initial creation without making cloud changes', async () => {
    const { env, log } = await fixture();
    await expect(runScript('bootstrap-aws-site.sh', { ...env, EXISTING_RECORDS: 'audiobrain.org. A' }, ['--yes']))
      .rejects.toThrow('Existing apex/www records');
    expect(await readFile(log, 'utf8')).not.toContain('"deploy"');
  });

  it('refuses to update an existing stack that identifies another site', async () => {
    const { env, log } = await fixture();
    await expect(runScript('bootstrap-aws-site.sh', { ...env, EXISTING_STACK_URL: 'https://another-site.example' }, ['--yes']))
      .rejects.toThrow('review ownership');
    expect(await readFile(log, 'utf8')).not.toContain('"deploy"');
  });

  it('prepares a change set without executing it', async () => {
    const { env, log } = await fixture();
    const result = await runScript('bootstrap-aws-site.sh', env, ['--plan']);
    expect(result.stdout).toContain('without execution');
    const commands = await readFile(log, 'utf8');
    expect(commands).toContain('"--no-execute-changeset"');
    expect(commands).toContain('GitHubOidcSubject=repo:blechdom/audiobrain:environment:production');
    expect(commands).toContain('CreateGitHubOidcProvider=false');
  });

  it('dry-runs assets before HTML without deleting assets or invalidating', async () => {
    const { directory, env, log } = await fixture();
    const artifact = join(directory, 'site');
    await mkdir(join(artifact, 'storybook'), { recursive: true });
    await writeFile(join(artifact, 'index.html'), '<title>AudioBrain</title>');
    await writeFile(join(artifact, 'build.json'), JSON.stringify({ app: 'audiobrain', version: '0.1.0', commit: 'test' }));
    for (const file of ['index.html', 'iframe.html']) await writeFile(join(artifact, 'storybook', file), '<html></html>');
    const entries = Object.fromEntries([
      'controls-parameter--numeric', 'workspace-performance--shapes',
      'workspace-performance--l-systems', 'workspace-performance--graphs', 'workspace-graph--shapes',
    ].map(id => [id, { id }]));
    await writeFile(join(artifact, 'storybook', 'index.json'), JSON.stringify({ entries }));
    await runScript('deploy-aws-site.sh', {
      ...env, DRY_RUN: 'true', AWS_SITE_BUCKET: 'audiobrain-test', AWS_CLOUDFRONT_DISTRIBUTION_ID: 'TEST',
    }, [artifact]);
    const commands = (await readFile(log, 'utf8')).trim().split('\n').map(line => JSON.parse(line) as string[]);
    expect(commands).toHaveLength(2);
    expect(commands[0]?.slice(0, 2)).toEqual(['s3', 'sync']);
    expect(commands[1]?.slice(0, 2)).toEqual(['s3', 'cp']);
    expect(commands.every(args => args.includes('--dryrun'))).toBe(true);
    expect(commands.flat()).not.toContain('--delete');
    expect(commands[1]).toContain('public,max-age=0,must-revalidate');
  });

  it('keeps the origin private and the role scoped without a copied OIDC default', async () => {
    const template = await readFile(resolve('infra/site.yml'), 'utf8');
    expect(template).toContain('Default: audiobrain.org');
    expect(template).toContain('BlockPublicAcls: true');
    expect(template).toContain('SigningBehavior: always');
    expect(template).toContain('DeletionPolicy: Retain');
    expect(template).toContain('token.actions.githubusercontent.com:sub: !Ref GitHubOidcSubject');
    expect(template).toContain('Resource: !Sub ${SiteBucket.Arn}/*');
    expect(template).not.toContain('Default: repo:');
    expect(template).not.toContain('videobrain');
    expect(template).not.toContain('s3:DeleteObject');
  });
});
