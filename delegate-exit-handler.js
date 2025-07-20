// Shared handler for SIGINT and SIGTERM for all delegate scripts
export function setupDelegateExitHandlers() {
    process.on('uncaughtException', (error) => {
        if (error instanceof Error && error.name === 'ExitPromptError') {
            // Optional: console.log('👋 until next time!');
            process.exit(130); // Use 130 to signal SIGINT to parent
        } else {
            throw error;
        }
    });
}
