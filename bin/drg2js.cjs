#!/usr/bin/env node

/* Dragon to Babel JS AST to JS code using Babel generator */

const parser = require('../src/parser.cjs');

const generateJavaScript = require('../src/codegen.cjs');
const fs = require('fs');
const { Command } = require('commander'); 
const packageJson = require('../package.json');
const { formatError, printAstIfRequested, validateInputFile, writeJsOutput } = require('../src/io-helpers.cjs');
const { runSandboxWithDiagnostics } = require('../src/sandbox-helpers.cjs');

const program = new Command();

program
    .version(packageJson.version)
    .description('Babel JS AST Generator. Transforms Dragon source code into Babel-compatible JavaScript AST and generates JavaScript code.')
    .option('-o, --output <fileName>', 'Output file name with generated JavaScript code (default: <input>.js)')
    .option('-a, --ast', 'Output the Babel AST as JSON instead of generated JavaScript code')
    .option('-s, --sandbox', 'Execute generated JavaScript code in a sandboxed environment and print the output')
    .option('-v, --verbose', 'Enable verbose output')
    .addHelpText('after', `
If option --ast is specified, and option --output is specified, the Babel AST will be saved to a file with the name specified in --output concatenated with '.ast.json'.
If option --ast and option --verbose are specified together, the AST structure will be printed to stderr in a human-readable format using insp() with depth: null, and the generated JavaScript code will be printed to stdout.
Otherwise if option --ast is used without options -o or -v it does nothing.
If option --sandbox is specified, generated JavaScript code will be executed in a sandboxed context. Any output from console.log() in the generated code will be printed to stdout. If an error occurs during execution, the error message will be printed to stderr, and if --verbose is also specified, the stack trace will be printed as well.`)
    .usage('[options] <filename>');

program.parse(process.argv);
const options = program.opts();

async function main() {
    const inputFile = program.args[0];
    const inputValidation = validateInputFile(inputFile, program);
    if (inputValidation === false) {
        process.exit(1);
    }
    if (inputValidation === null) {
        return;
    }

    const input = fs.readFileSync(inputFile, 'utf-8');
    if (!options.output) {
        options.output = inputFile.toLowerCase().endsWith('.drg')
            ? `${inputFile.slice(0, -4)}.js`
            : `${inputFile}.js`;
    }

    try {
        const ast = parser.parse(input);

        printAstIfRequested(ast, inputFile, options);
        const {code, map} = generateJavaScript(ast, options, input, inputFile);

        if (options.sandbox) {
            const sandboxResult = runSandboxWithDiagnostics(code, inputFile, {
                verbose: options.verbose,
                SourceMap: map
            });
            if (!sandboxResult.ok) {
                console.error(sandboxResult.message);
                if (sandboxResult.stack) {
                    console.error(sandboxResult.stack);
                }
                process.exit(1);
            }
        }

        await writeJsOutput(code, options, map);
    } catch (err) {
        console.error(formatError(err, inputFile));
        if (options.verbose) {
            console.error(err.stack);
        }
        process.exit(1);
    }
}

//  The main function is exported for testing purposes
module.exports = main;

// If this script is run directly from the command line, execute the main function. This allows the same code to be imported as a module without executing the main function, which is useful for testing.
if (require.main === module) {
    main().catch((err) => {
        console.error(err && err.message ? `Error: ${err.message}` : String(err));
        if (options.verbose && err && err.stack) {
            console.error(err.stack);
        }
        process.exit(1);
    });
}