import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import inquirer from 'inquirer';
import { spawn } from 'child_process';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execPromise = promisify(exec);
const program = new Command();

const figletPromise = (text, options) => {
    return new Promise((resolve, reject) => {
        figlet.text(text, options, (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });
};

const executeCommand = (command, args, cwd) => {
    return new Promise((resolve, reject) => {
        console.log(chalk.dim(`$ ${command} ${args.join(' ')}`));

        const childProcess = spawn(command, args, {
            cwd,
            stdio: 'inherit',
            shell: true
        });

        childProcess.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with exit code ${code}`));
            }
        });

        childProcess.on('error', (error) => {
            reject(error);
        });
    });
};

const templateRegistry = {
    'beluga-stack-one': { name: 'Beluga Stack ONE', context: 'node' },
    'python-with-api': { name: 'Python (with API)', context: 'python' },
    'tsup': { name: 'tsup', context: 'node' }
};

program
    .version('0.3.0')
    .description('Create a new beluga stack app')
    .argument('<name>', 'Project name')
    .action(async (name) => {
        try {
            const banner = await figletPromise('beluga stack', {
                font: 'Slant',
                horizontalLayout: 'default',
                verticalLayout: 'default',
                width: 80,
                whitespaceBreak: false
            });

            console.log(banner);
            console.log(chalk.cyan('✨ Welcome to Beluga Stack CLI ✨'));
            console.log(
                chalk.green(
                    `🚀 Creating a new project called ${chalk.bold(name)}`
                )
            );

            const appTypeChoices = Object.entries(templateRegistry).map(
                ([id, meta]) => ({
                    name: meta.name,
                    value: id
                })
            );

            let appType = '';
            let context = '';

            const { appType: selectedAppType } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'appType',
                    message: '📋 Which type of app would you like to create?',
                    choices: appTypeChoices
                }
            ]);

            appType = selectedAppType;
            context = templateRegistry[appType].context;
            const isNode = context === 'node';
            const isPython = context === 'python';

            let repoUrl;
            let templateDir;
            let targetDir;
            let cmsOption;

            if (appType === 'beluga-stack-one') {
                const { cmsOption: selectedCmsOption } = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'cmsOption',
                        message: '🔧 Would you like to include Payload CMS?',
                        choices: [
                            { name: 'NextJS', value: 'nextjs' },
                            {
                                name: 'NextJS with Payload CMS',
                                value: 'nextjs-payload'
                            }
                        ]
                    }
                ]);
                cmsOption = selectedCmsOption;
                repoUrl = 'https://github.com/beluga-labs/beluga-stack-ONE';
                targetDir = path.join(name, 'apps', 'web');
            } else {
                repoUrl = 'https://github.com/beluga-labs/beluga-templates';
                templateDir = path.join(name, 'templates', appType);
                targetDir = name;
            }

            console.log(
                chalk.cyan(
                    `📥 Cloning the repository from ${chalk.bold(repoUrl)}...`
                )
            );
            await executeCommand(
                'git',
                ['clone', repoUrl, name],
                process.cwd()
            );
            console.log(chalk.green(`✅ Repository cloned successfully`));

            if (appType !== 'beluga-stack-one') {
                console.log(chalk.cyan(`🔄 Processing template files...`));
                const rootFiles = fs.readdirSync(name);
                for (const file of rootFiles) {
                    if (file !== 'templates' && file !== '.git') {
                        fs.rmSync(path.join(name, file), {
                            recursive: true,
                            force: true
                        });
                    }
                }

                const templateContent = fs.readdirSync(templateDir);
                for (const item of templateContent) {
                    fs.cpSync(
                        path.join(templateDir, item),
                        path.join(targetDir, item),
                        {
                            recursive: true
                        }
                    );
                }

                fs.rmSync(path.join(name, 'templates'), {
                    recursive: true,
                    force: true
                });
            } else {
                console.log(chalk.cyan(`📋 Setting up template structure...`));

                // Handle the apps in the apps directory
                const appsDir = path.join(name, 'apps');
                const selectedApp = cmsOption;
                const nonSelectedApp = selectedApp === 'nextjs-payload' ? 'nextjs' : 'nextjs-payload';

                // Delete the non-selected app
                fs.rmSync(path.join(appsDir, nonSelectedApp), {
                    recursive: true,
                    force: true
                });

                // Rename the selected app to web
                fs.renameSync(
                    path.join(appsDir, selectedApp),
                    targetDir
                );

                // Update package.json in the web app
                const webPackageJsonPath = path.join(targetDir, 'package.json');
                const webPackageJson = JSON.parse(fs.readFileSync(webPackageJsonPath, 'utf-8'));
                webPackageJson.name = 'web';
                fs.writeFileSync(
                    webPackageJsonPath,
                    JSON.stringify(webPackageJson, null, 2),
                    'utf-8'
                );
            }
            console.log(
                chalk.green(`✅ Template structure set up successfully`)
            );

            let packageManager = '';

            if (isNode) {
                const packageJsonPath = path.join(name, 'package.json');
                const packageJson = JSON.parse(
                    fs.readFileSync(packageJsonPath, 'utf-8')
                );

                ({ packageManager } = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'packageManager',
                        message:
                            '📦 Which package manager would you like to use?',
                        choices: [
                            { name: 'pnpm', value: 'pnpm' },
                            { name: 'npm', value: 'npm' },
                            { name: 'yarn', value: 'yarn' },
                            { name: 'bun', value: 'bun' }
                        ]
                    }
                ]));

                let packageManagerVersion = '';
                try {
                    const { stdout } = await execPromise(
                        `${packageManager} --version`
                    );
                    packageManagerVersion = `${packageManager}@${stdout.trim()}`;
                } catch (error) {
                    console.warn(
                        chalk.yellow(
                            `⚠️ Couldn't detect ${packageManager} version. Continuing without version info.`
                        )
                    );
                }

                packageJson.name = name;
                packageJson.packageManager = packageManagerVersion;
                fs.writeFileSync(
                    packageJsonPath,
                    JSON.stringify(packageJson, null, 2),
                    'utf-8'
                );
                console.log(
                    chalk.green(`✅ Updated package.json with project settings`)
                );

                console.log(
                    chalk.cyan(
                        `📦 Installing dependencies with ${chalk.bold(packageManager)}...`
                    )
                );
                console.log(
                    chalk.yellow(
                        `This might take a few minutes depending on your internet connection...`
                    )
                );

                await executeCommand(packageManager, ['install'], targetDir);
                console.log(
                    chalk.green(`✅ Dependencies installed successfully`)
                );
            }

            console.log(chalk.cyan(`🧹 Cleaning up unnecessary files...`));
            fs.rmSync(path.join(name, '.git'), {
                recursive: true,
                force: true
            });
            try {
                fs.rmSync(path.join(name, 'templates'), {
                    recursive: true,
                    force: true
                });
            } catch (error) {
                // Ignore if templates folder doesn't exist
            }
            console.log(chalk.green(`✅ Cleanup completed`));

            console.log(chalk.cyan(`🔄 Setting up git repository...`));
            await executeCommand('git', ['init'], name);
            await execPromise(`git add . && git commit -m "Initial commit"`, {
                cwd: name
            });
            console.log(chalk.green(`✅ Git repository initialized`));

            console.log('\n' + chalk.green.bold('✅ Setup complete!'));
            console.log(
                chalk.cyan(
                    `\n📁 Your new project is ready in the '${chalk.bold(name)}' folder`
                )
            );
            console.log(chalk.cyan(`🚀 To get started, run:`));
            console.log(chalk.white(`  cd ${name}`));
            if (isNode) {
                console.log(chalk.white(`  ${packageManager} dev`));
            }
            if (isPython) {
                console.log(chalk.white(`  pdm install`));
                console.log(chalk.white(`  pdm run python run.py`));
            }
        } catch (error) {
            console.error(
                chalk.red('❌ An error occurred during setup:'),
                error
            );
            process.exit(1);
        }
    });

program.parse();