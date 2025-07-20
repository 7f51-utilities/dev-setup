#!/usr/bin/env node
import fs from 'fs';
import inquirer from 'inquirer';
import { setupDelegateExitHandlers } from './delegate-exit-handler.js';
import path from 'path';

setupDelegateExitHandlers();

const workflowsDir = '.github/workflows';
if (!fs.existsSync(workflowsDir)) {
    fs.mkdirSync(workflowsDir, { recursive: true });
}

// Helper to copy a template if not exists
function copyWorkflowTemplate(templateName, destName) {
    const templatePath = path.join('.templates', templateName);
    const destPath = path.join(workflowsDir, destName);
    if (!fs.existsSync(destPath) && fs.existsSync(templatePath)) {
        fs.copyFileSync(templatePath, destPath);
        console.log(`${destName} workflow created from template.`);
    }
}

async function main() {
    // Always proceed with Semantic Release setup (no prompt)
    console.log('Setting up Semantic Release...');

    copyWorkflowTemplate('release.yml', 'release.yml');
    copyWorkflowTemplate('pre-release.yml', 'pre-release.yml');

    // Ask if the package should be published to npm
    const { publishNpm } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'publishNpm',
            message: 'Should this package be published to npm?',
            default: false
        }
    ]);

    // Read package.json
    const pkgPath = './package.json';
    let pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    // Add or remove npm publish fields
    if (publishNpm) {
        pkg.private = false;
        pkg.publishConfig = { access: 'public' };
        if (!pkg.repository) {
            const { repoUrl } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'repoUrl',
                    message: 'Repository URL (for npm):',
                    default: ''
                }
            ]);
            if (repoUrl) {
                pkg.repository = { type: 'git', url: repoUrl };
            }
        }
        if (!pkg.license) {
            pkg.license = 'MIT';
        }
        if (!pkg.author) {
            const { author } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'author',
                    message: 'Author (for npm):',
                    default: ''
                }
            ]);
            if (author) pkg.author = author;
        }
        if (!pkg.keywords || !Array.isArray(pkg.keywords)) {
            pkg.keywords = [];
        }
        if (!pkg.homepage && pkg.repository && pkg.repository.url) {
            pkg.homepage = pkg.repository.url.replace(/\.git$/, '') + '#readme';
        }
        if (!pkg.bugs && pkg.repository && pkg.repository.url) {
            pkg.bugs = { url: pkg.repository.url.replace(/\.git$/, '') + '/issues' };
        }
    } else {
        pkg.private = true;
        delete pkg.publishConfig;
    }

    // Ensure devDependencies for semantic-release and plugins
    const devDeps = [
        'semantic-release',
        '@semantic-release/changelog',
        '@semantic-release/commit-analyzer',
        '@semantic-release/git',
        '@semantic-release/github',
        '@semantic-release/npm'
    ];
    if (!pkg.devDependencies) pkg.devDependencies = {};
    const missingDeps = devDeps.filter(dep => !pkg.devDependencies[dep]);
    if (missingDeps.length > 0) {
        const { execSync } = await import('child_process');
        console.log('Installing missing devDependencies:', missingDeps.join(', '));
        execSync(`npm install --save-dev ${missingDeps.join(' ')}`, { stdio: 'inherit' });
        // Reload package.json after install
        pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    }
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 4));
    console.log('package.json updated for npm publish:', publishNpm);

    // Write a basic release.config.cjs if not present
    const relPath = './release.config.cjs';
    if (!fs.existsSync(relPath)) {
        const relConfig = `const config = {\n    branches: [\n        'main',\n        { name: 'dev', prerelease: 'beta' }\n    ],\n    plugins: [\n        '@semantic-release/commit-analyzer',\n        '@semantic-release/release-notes-generator',\n        [\n            '@semantic-release/changelog',\n            { changelogFile: 'CHANGELOG.md' }\n        ],\n        [\n            '@semantic-release/npm',\n            { npmPublish: ${publishNpm ? 'true' : 'false'}, access: 'public' }\n        ],\n        [\n            '@semantic-release/git',\n            { assets: ['package.json', 'CHANGELOG.md', 'dist/**'] }\n        ],\n        [\n            '@semantic-release/github',\n            { assets: ['dist/**'] }\n        ]\n    ]\n};\n\nmodule.exports = config;\n`;
        fs.writeFileSync(relPath, relConfig);
        console.log('release.config.cjs created.');
    }
}

main();
