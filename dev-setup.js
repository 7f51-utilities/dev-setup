#!/usr/bin / env node

// Gracefully handle Ctrl+C (SIGINT) to halt all further execution
process.on('SIGINT', () => {
    console.log('\nSetup cancelled by user.');
    process.exit(130); // 130 is standard exit code for SIGINT
});

import inquirer from 'inquirer';
import { execSync } from 'child_process';
import path from 'path';


function printDelegateSeparator() {
    process.stdout.write('\n\n');
}

process.on('uncaughtException', (error) => {
    if (error instanceof Error && error.name === 'ExitPromptError') {
        console.log('👋 until next time!');
    } else {
        // Rethrow unknown errors
        throw error;
    }
});

function runDelegate(script, yFlag, extra = '', verbose = false) {
    let cmd = `node ${path.join(process.cwd(), script)}${yFlag}`;
    if (extra) cmd += ` ${extra}`;
    if (verbose) cmd += ' --verbose';
    try {
        execSync(cmd, { stdio: 'inherit' });
    } catch (e) {

        if (
            (e instanceof Error && e.name === 'ExitPromptError') ||
            (e && typeof e === 'object' && (e.status === 130 || e.signal === 'SIGINT'))
        ) {
            console.log('👋 Process terminated by user.');
            process.exit(130);
        } else {
            // Rethrow unknown errors
            throw e;
        }
    }
    printDelegateSeparator();
}

function parseArgs() {
    const args = process.argv.slice(2);
    const flags = {
        yes: false,
        docker: false,
        tasks: false,
        semanticRelease: false,
        semanticVerbose: false
    };
    for (const arg of args) {
        if (arg === '-y' || arg === '--yes') flags.yes = true;
        if (arg === '--docker') flags.docker = true;
        if (arg === '--tasks') flags.tasks = true;
        if (arg === '--semantic-release') flags.semanticRelease = true;
    }
    // If no specific flags, set a flag to indicate prompting mode
    flags.promptMode = false;
    if (!flags.docker && !flags.tasks && !flags.semanticRelease) {
        flags.promptMode = true;
    }
    return flags;
}

async function main() {
    const flags = parseArgs();
    const yFlag = flags.yes ? ' -y' : '';
    if (flags.yes) {
        // In promptMode, run all steps; in flag mode, run only flagged steps
        let runDocker = flags.promptMode || flags.docker;
        let runTasks = flags.promptMode || flags.tasks;
        let runSemantic = flags.promptMode || flags.semanticRelease;

        if (runDocker) runDelegate('generate-docker-compose.js', yFlag);
        if (runTasks) runDelegate('generate-tasks.js', yFlag);
        if (runSemantic) runDelegate('setup-semantic-release.js', yFlag, '', flags.semanticVerbose);
    } else if (flags.promptMode) {
        // Prompting mode: ask for each step
        // Docker Compose
        let doDocker = false;
        const { confirm: dockerConfirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: 'Do you want to generate docker-compose.yml and DB user scripts?',
                default: true
            }
        ]);
        doDocker = dockerConfirm;
        if (doDocker) runDelegate('generate-docker-compose.js', '');

        // Tasks
        let doTasks = false;
        const { confirm: tasksConfirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: 'Do you want to generate tasks.json for XAMPP/Herd?',
                default: true
            }
        ]);
        doTasks = tasksConfirm;
        if (doTasks) runDelegate('generate-tasks.js', '');

        // Semantic Release
        let doSemantic = false;
        const { confirm: semanticConfirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: 'Do you want to set up Semantic Release (and npm publish config)?',
                default: false
            }
        ]);
        doSemantic = semanticConfirm;
        if (doSemantic) runDelegate('setup-semantic-release.js', '', '', flags.semanticVerbose);
    } else {
        // Flag mode: only run flagged steps, with prompts
        // Docker Compose
        let doDocker = flags.docker;
        if (flags.docker) {
            const { confirm } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: 'Do you want to generate docker-compose.yml and DB user scripts?',
                    default: true
                }
            ]);
            doDocker = confirm;
        }
        if (doDocker) runDelegate('generate-docker-compose.js', '');

        // Tasks
        let doTasks = flags.tasks;
        if (flags.tasks) {
            const { confirm } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: 'Do you want to generate tasks.json for XAMPP/Herd?',
                    default: true
                }
            ]);
            doTasks = confirm;
        }
        if (doTasks) runDelegate('generate-tasks.js', '');

        // Semantic Release
        let doSemantic = flags.semanticRelease;
        if (flags.semanticRelease) {
            const { confirm } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: 'Do you want to set up Semantic Release (and npm publish config)?',
                    default: false
                }
            ]);
            doSemantic = confirm;
        }
        if (doSemantic) runDelegate('setup-semantic-release.js', '', '', flags.semanticVerbose);
    }
    console.info('All selected operations completed.');
}

main();
