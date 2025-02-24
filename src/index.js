const { Command } = require('commander');
const chalk = require('chalk');
const figlet = require('figlet');
const inquirer = require('inquirer');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const program = new Command();

const text = 'beluga stack';

// ASCII-Art erstellen
figlet.text(
  text,
  {
    font: "Slant",
    horizontalLayout: "default",
    verticalLayout: "default",
    width: 80,
    whitespaceBreak: false,
  },
  function (err, data) {
    if (err) {
      console.log("Something went wrong...");
      console.dir(err);
      return;
    }
    console.log(data);
  }
);

program
  .version('1.0.0')
  .description('Create a new beluga stack ONE app')
  .argument('<name>', 'Project name')
  .action(async (name) => {
    console.log(chalk.green(`Creating a new project called ${name}`));

    // Abfrage der App-Variante
    const { appType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'appType',
        message: 'Which type of app would you like to create?',
        choices: [
          { name: 'NextJS with PayloadCMS', value: 'nextjs-payload' },
          { name: 'NextJS', value: 'nextjs' }
        ]
      }
    ]);

    // Klonen des Haupt-Repositories
    const repoUrl = 'https://github.com/beluga-digital/beluga-stack-ONE';
    console.log(chalk.cyan(`Cloning the repository from ${repoUrl}...`));
    execSync(`git clone ${repoUrl} ${name}`);

    // Pfad zum Templates-Verzeichnis und Zielverzeichnis
    const templateDir = path.join(name, 'templates', appType);
    const targetDir = path.join(name, 'apps', 'web');

    // Kopieren des ausgewählten Templates
    fs.cpSync(templateDir, targetDir, { recursive: true });

    // Entfernen des Templates-Verzeichnisses
    fs.rmSync(path.join(name, 'templates'), { recursive: true, force: true });

    // Installieren der Abhängigkeiten
    console.log(chalk.cyan('Installing dependencies...'));
    execSync(`cd ${name} && npm install`);

    console.log(chalk.green('Setup complete!'));
  });

program.parse();