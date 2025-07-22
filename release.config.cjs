const config = {
    branches: [
        'main',
        { name: 'dev', prerelease: 'beta' }
    ],
    plugins: [
        '@semantic-release/commit-analyzer',
        '@semantic-release/release-notes-generator',
        [
            '@semantic-release/changelog',
            { changelogFile: 'CHANGELOG.md' }
        ],
        [
            '@semantic-release/npm',
            {
                npmPublish: true,
                access: 'public',
                // Always use 'latest' dist-tag, even for prereleases
                distTag: 'latest'
            }
        ],
        [
            '@semantic-release/git',
            { assets: ['package.json', 'CHANGELOG.md', 'dist/**'] }
        ],
        [
            '@semantic-release/github',
            { assets: ['dist/**'] }
        ]
    ]
};

module.exports = config;
