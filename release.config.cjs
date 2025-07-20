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
            { npmPublish: false, access: 'public' }
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
