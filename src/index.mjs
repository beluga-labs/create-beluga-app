import { Command } from "commander";
import chalk from "chalk";
import figlet from "figlet";
import inquirer from "inquirer";
import { spawn } from "child_process";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

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
    console.log(chalk.dim(`$ ${command} ${args.join(" ")}`));

    const childProcess = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: true,
    });

    childProcess.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    childProcess.on("error", (error) => {
      reject(error);
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
      await executeCommand("git", ["clone", repoUrl, name], process.cwd());
      console.log(chalk.green(`✅ Repository cloned successfully`));

      if (appType !== "beluga-stack-one") {
        console.log(chalk.cyan(`🔄 Processing template files...`));
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
      console.log(chalk.green(`✅ Template structure set up successfully`));

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
      console.log(chalk.green(`✅ Updated package.json with project settings`));

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

      await executeCommand(packageManager, ["install"], targetDir);
      console.log(chalk.green(`✅ Dependencies installed successfully`));

      console.log(chalk.cyan(`🧹 Cleaning up unnecessary files...`));
      fs.rmSync(path.join(name, ".git"), { recursive: true, force: true });
      try {
        fs.rmSync(path.join(name, "templates"), {
          recursive: true,
          force: true,
        });
      } catch (error) {
        // Ignoriere Fehler, falls der templates-Ordner nicht existiert
      }
      console.log(chalk.green(`✅ Cleanup completed`));

      console.log(chalk.cyan(`🔄 Setting up git repository...`));
      await executeCommand("git", ["init"], name);
      await execPromise(`git add . && git commit -m "Initial commit"`, {
        cwd: name,
      });
      console.log(chalk.green(`✅ Git repository initialized`));

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
