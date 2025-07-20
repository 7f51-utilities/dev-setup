#!/usr/bin/env node
import fs from 'fs';
import inquirer from 'inquirer';
import os from 'os';
import { setupDelegateExitHandlers } from './delegate-exit-handler.js';

setupDelegateExitHandlers();

async function main() {
    const platform = os.platform();
    let defaultXamppPath = '';
    let defaultHerdPath = '';
    if (platform === 'win32') {
        defaultXamppPath = 'C:/xampp';
        defaultHerdPath = 'Herd.exe';
    } else if (platform === 'darwin') {
        defaultXamppPath = '/Applications/XAMPP';
        defaultHerdPath = '/usr/local/bin/herd';
    } else {
        defaultXamppPath = '/opt/lampp';
        defaultHerdPath = '/usr/local/bin/herd';
    }

    // Load last-used XAMPP path from .setup-history.json if available
    let historyPath = './setup-history.json';
    let lastUsedXamppPath = null;
    if (fs.existsSync(historyPath)) {
        try {
            const hist = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
            if (hist && hist.xamppPath) lastUsedXamppPath = hist.xamppPath;
        } catch (e) { }
    }
    const xamppDefault = lastUsedXamppPath || defaultXamppPath;

    // Ask for XAMPP path, allow Enter to use default (last-used if available)
    const { xamppPathInput } = await inquirer.prompt([
        {
            type: 'input',
            name: 'xamppPathInput',
            message: `Enter XAMPP installation path (press Enter for default: ${xamppDefault}):`,
            default: xamppDefault
        }
    ]);
    const xamppPath = xamppPathInput && xamppPathInput.trim() !== '' ? xamppPathInput : xamppDefault;
    const herdPath = defaultHerdPath;

    // Save last-used XAMPP path to .setup-history.json
    try {
        fs.writeFileSync(historyPath, JSON.stringify({ xamppPath }, null, 2));
    } catch (e) { }

    let launchXamppCmd = '';
    let launchHerdCmd = '';
    if (platform === 'win32') {
        launchXamppCmd = `if ((Get-Content .env | Select-String 'DB_CONNECTION=mysql') -and -not (Get-Process -Name 'xampp-control' -ErrorAction SilentlyContinue)) { Start-Process '${xamppPath.replace(/\\/g, '/')}/xampp-control.exe'; Start-Sleep -Seconds 3; Start-Process '${xamppPath.replace(/\\/g, '/')}/xampp_start.exe' }`;
        launchHerdCmd = `if (-not (Get-Process -Name 'Herd' -ErrorAction SilentlyContinue)) { Start-Process '${herdPath}' }`;
    } else {
        launchXamppCmd = `echo 'XAMPP launch for non-Windows is not implemented.'`;
        launchHerdCmd = `echo 'Herd launch for non-Windows is not implemented.'`;
    }

    // Ensure .vscode directory exists
    const vscodeDir = './.vscode';
    if (!fs.existsSync(vscodeDir)) {
        fs.mkdirSync(vscodeDir);
    }
    // Read or create .vscode/tasks.json
    const tasksJsonPath = `${vscodeDir}/tasks.json`;
    let tasks = { version: '2.0.0', tasks: [] };
    if (fs.existsSync(tasksJsonPath)) {
        try {
            tasks = JSON.parse(fs.readFileSync(tasksJsonPath, 'utf8'));
            if (!Array.isArray(tasks.tasks)) tasks.tasks = [];
        } catch (e) {
            console.error('Could not parse existing tasks.json, starting fresh.');
        }
    }

    // Helper to avoid duplicate tasks by label
    function addOrReplaceTask(task) {
        const idx = tasks.tasks.findIndex(t => t.label === task.label);
        if (idx !== -1) {
            tasks.tasks[idx] = task;
        } else {
            tasks.tasks.push(task);
        }
    }

    // Add Launch Herd task
    addOrReplaceTask({
        label: 'Launch Herd',
        type: 'shell',
        command: launchHerdCmd,
        group: 'none',
        presentation: {
            reveal: 'silent',
            panel: 'new',
            showReuseMessage: false,
            close: true
        },
        problemMatcher: []
    });

    // Add Launch Xampp task
    addOrReplaceTask({
        label: 'Launch Xampp',
        type: 'shell',
        command: launchXamppCmd,
        group: 'none',
        presentation: {
            reveal: 'silent',
            panel: 'new',
            showReuseMessage: false,
            close: true
        },
        problemMatcher: []
    });

    fs.writeFileSync(tasksJsonPath, JSON.stringify(tasks, null, 4));
    console.info('.vscode/tasks.json updated with Launch Herd and Launch Xampp tasks!');
}

main();
