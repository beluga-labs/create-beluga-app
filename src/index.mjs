import { Command } from "commander";
import chalk from "chalk";
import figlet from "figlet";
import inquirer from "inquirer";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execPromise = promisify(exec);
const program = new Command();

// Promisify figlet.text für bessere Async-Handhabung
const figletPromise = (text, options) => {
  return new Promise((resolve, reject) => {
    figlet.text(text, options, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
};

program
  .version("0.2.3")
  .description("Create a new beluga stack app")
  .argument("<name>", "Project name")
  .action(async (name) => {
    try {
      // Banner vor allem anderen anzeigen
      const banner = await figletPromise("beluga stack", {
        font: "Slant",
        horizontalLayout: "default",
        verticalLayout: "default",
        width: 80,
        whitespaceBreak: false,
      });

      console.log(banner);
      console.log(chalk.cyan("✨ Welcome to Beluga Stack CLI ✨"));
      console.log(
        chalk.green(`🚀 Creating a new project called ${chalk.bold(name)}`)
      );

      const { appType } = await inquirer.prompt([
        {
          type: "list",
          name: "appType",
          message: "📋 Which type of app would you like to create?",
          choices: [
            { name: "Beluga Stack ONE", value: "beluga-stack-one" },
            // coming soon
            // { name: "NextJS", value: "nextjs" },
            // { name: "Vite", value: "vite" },
            { name: "tsup", value: "tsup" },
          ],
        },
      ]);

      let repoUrl;
      let templateDir;
      let targetDir;

      if (appType === "beluga-stack-one") {
        const { cmsOption } = await inquirer.prompt([
          {
            type: "list",
            name: "cmsOption",
            message: "🔧 Would you like to include Payload CMS?",
            choices: [
              { name: "With Payload CMS", value: "nextjs-payload" },
              { name: "Without Payload CMS", value: "nextjs" },
            ],
          },
        ]);

        repoUrl = "https://github.com/beluga-labs/beluga-stack-ONE";
        templateDir = path.join(name, "templates", cmsOption);
        targetDir = path.join(name, "apps", "web");
      } else {
        repoUrl = "https://github.com/beluga-labs/beluga-templates";
        templateDir = path.join(name, "templates", appType);
        targetDir = name; // Kopiere den Inhalt direkt ins Root-Verzeichnis
      }

      console.log(
        chalk.cyan(`📥 Cloning the repository from ${chalk.bold(repoUrl)}...`)
      );
      await execPromise(`git clone ${repoUrl} ${name}`);

      if (appType !== "beluga-stack-one") {
        // Lösche alle Dateien auf der Root-Ebene außer dem templates-Ordner
        const rootFiles = fs.readdirSync(name);
        for (const file of rootFiles) {
          if (file !== "templates" && file !== ".git") {
            fs.rmSync(path.join(name, file), { recursive: true, force: true });
          }
        }

        // Verschiebe den Inhalt des gewählten Templates ins Root-Verzeichnis
        const templateContent = fs.readdirSync(templateDir);
        for (const item of templateContent) {
          fs.cpSync(path.join(templateDir, item), path.join(targetDir, item), {
            recursive: true,
          });
        }

        // Lösche den templates-Ordner
        fs.rmSync(path.join(name, "templates"), {
          recursive: true,
          force: true,
        });
      } else {
        console.log(chalk.cyan(`📋 Setting up template structure...`));
        fs.cpSync(templateDir, targetDir, { recursive: true });
      }

      const packageJsonPath = path.join(name, "package.json");
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

      const { packageManager } = await inquirer.prompt([
        {
          type: "list",
          name: "packageManager",
          message: "📦 Which package manager would you like to use?",
          choices: [
            { name: "pnpm", value: "pnpm" },
            { name: "npm", value: "npm" },
            { name: "yarn", value: "yarn" },
            { name: "bun", value: "bun" },
          ],
        },
      ]);

      // Ermitteln der Version des Paketmanagers
      let packageManagerVersion = "";
      try {
        const { stdout } = await execPromise(`${packageManager} --version`);
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
        "utf-8"
      );

      console.log(
        chalk.cyan(
          `📦 Installing dependencies with ${chalk.bold(packageManager)}...`
        )
      );
      await execPromise(`cd ${targetDir} && ${packageManager} install`);

      console.log(chalk.cyan(`🧹 Cleaning up unnecessary files...`));
      fs.rmSync(path.join(name, ".git"), { recursive: true, force: true });
      fs.rmSync(path.join(name, "templates"), { recursive: true, force: true });

      console.log(chalk.cyan(`🔄 Setting up git repository...`));
      await execPromise(
        `cd ${name} && git init && git add . && git commit -m "Initial commit"`
      );

      console.log("\n" + chalk.green.bold("✅ Setup complete!"));
      console.log(
        chalk.cyan(
          `\n📁 Your new project is ready in the '${chalk.bold(name)}' folder`
        )
      );
      console.log(chalk.cyan(`🚀 To get started, run:`));
      console.log(chalk.white(`  cd ${name}`));
      console.log(chalk.white(`  ${packageManager} dev\n`));
    } catch (error) {
      console.error(chalk.red("❌ An error occurred during setup:"), error);
      process.exit(1);
    }
  });

program.parse();
