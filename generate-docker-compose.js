#!/usr/bin/env node
import fs from 'fs';
import inquirer from 'inquirer';
import yaml from 'js-yaml';
import { setupDelegateExitHandlers } from './delegate-exit-handler.js';

setupDelegateExitHandlers();

const dbServices = {
    postgres: {
        image: 'postgres',
        env: [
            'POSTGRES_USER=rootuser',
            'POSTGRES_PASSWORD=rootpassword'
        ],
        ports: ['5432:5432'],
        volumes: ['./pg-init:/docker-entrypoint-initdb.d']
    },
    mysql: {
        image: 'mysql',
        env: [
            'MYSQL_ROOT_PASSWORD=rootpassword',
            'MYSQL_DATABASE=appdb',
            'MYSQL_USER=appuser',
            'MYSQL_PASSWORD=apppassword'
        ],
        ports: ['3306:3306'],
        volumes: ['./mysql-init:/docker-entrypoint-initdb.d']
    },
    mariadb: {
        image: 'mariadb',
        env: [
            'MARIADB_ROOT_PASSWORD=rootpassword',
            'MARIADB_DATABASE=appdb',
            'MARIADB_USER=appuser',
            'MARIADB_PASSWORD=apppassword'
        ],
        ports: ['3306:3306'],
        volumes: ['./mariadb-init:/docker-entrypoint-initdb.d']
    },
    mongodb: {
        image: 'mongo',
        env: [
            'MONGO_INITDB_ROOT_USERNAME=rootuser',
            'MONGO_INITDB_ROOT_PASSWORD=rootpassword'
        ],
        ports: ['27017:27017'],
        volumes: ['./mongo-init:/docker-entrypoint-initdb.d']
    },
    mssql: {
        image: 'mcr.microsoft.com/mssql/server:2022-latest',
        env: [
            'ACCEPT_EULA=Y',
            'MSSQL_SA_PASSWORD=RootPassword123',
            'MSSQL_PID=Express'
        ],
        ports: ['1433:1433'],
        volumes: ['./mssql-init:/docker-entrypoint-initdb.d']
    }
};

const redisService = {
    image: 'redis',
    ports: ['6379:6379']
};

async function main() {
    const { db } = await inquirer.prompt([
        {
            type: 'list',
            name: 'db',
            message: 'Which database provider?',
            choices: Object.keys(dbServices)
        }
    ]);

    const { addRedis } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'addRedis',
            message: 'Add Redis service?',
            default: false
        }
    ]);

    let services = {};
    services[db] = {
        image: dbServices[db].image,
        environment: dbServices[db].env,
        ports: dbServices[db].ports,
        volumes: dbServices[db].volumes
    };

    // Add init script for additional user if supported
    let appUser = 'appuser';
    let appPassword = 'apppassword';
    let initDir = '';
    let initFile = '';
    let userScript = '';
    if (db === 'postgres') {
        initDir = './pg-init';
        initFile = `${initDir}/init-app-user.sql`;
        userScript = `CREATE USER ${appUser} WITH PASSWORD '${appPassword}';\nGRANT CONNECT ON DATABASE postgres TO ${appUser};\nGRANT USAGE ON SCHEMA public TO ${appUser};\nGRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${appUser};\nALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${appUser};\n`;
    } else if (db === 'mysql' || db === 'mariadb') {
        initDir = db === 'mysql' ? './mysql-init' : './mariadb-init';
        initFile = `${initDir}/init-app-user.sql`;
        userScript = `CREATE USER IF NOT EXISTS '${appUser}'@'%' IDENTIFIED BY '${appPassword}';\nGRANT SELECT, INSERT, UPDATE, DELETE ON appdb.* TO '${appUser}'@'%';\nFLUSH PRIVILEGES;\n`;
    } else if (db === 'mssql') {
        initDir = './mssql-init';
        initFile = `${initDir}/init-app-user.sql`;
        // T-SQL for creating a user and granting permissions in SQL Server
        userScript = `USE master;\nGO\nCREATE LOGIN ${appUser} WITH PASSWORD = '${appPassword}';\nGO\nUSE tempdb;\nCREATE USER ${appUser} FOR LOGIN ${appUser};\nALTER ROLE db_datareader ADD MEMBER ${appUser};\nALTER ROLE db_datawriter ADD MEMBER ${appUser};\nGO\n`;
    }
    if (userScript) {
        if (!fs.existsSync(initDir)) {
            fs.mkdirSync(initDir, { recursive: true });
        }
        fs.writeFileSync(initFile, userScript);
    }

    if (addRedis) {
        services.redis = {
            image: redisService.image,
            ports: redisService.ports
        };
    }

    // Merge with existing docker-compose.yml if it exists
    let compose = { version: '3.8', services: {} };
    if (fs.existsSync('docker-compose.yml')) {
        try {
            const existing = yaml.load(fs.readFileSync('docker-compose.yml', 'utf8'));
            if (existing && typeof existing === 'object') {
                compose = existing;
                if (!compose.services) compose.services = {};
            }
        } catch (e) {
            console.error('Could not parse existing docker-compose.yml, starting fresh.');
        }
    }
    // Merge/overwrite services
    compose.version = '3.8';
    compose.services = { ...compose.services, ...services };

    fs.writeFileSync('docker-compose.yml', yaml.dump(compose, { lineWidth: -1 }));
    console.info('docker-compose.yml updated!');
    if (userScript) {
        console.info(`\nApp DB user created: ${appUser}`);
        console.info(`App DB password: ${appPassword}`);
    }
}



main();