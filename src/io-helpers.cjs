const { inspect } = require('util');
const fs = require('fs');
const path = require('path');

function validateInputFile(inputFile, program) {
    if (!inputFile) {
        console.error('Error: No input file specified');
        program.help();
        return null;
    }

    if (!fs.existsSync(inputFile)) {
        console.error(`Error: File '${inputFile}' not found`);
        return false;
    }

    return true;
}

function printAstIfRequested(ast, inputFile, options) {
    if (options.verbose && !options.sandbox) {
        console.error(`Parsed input from ${inputFile}`);
        if (options.ast) {
            console.error('AST structure:');
            console.log(inspect(ast, { depth: null }));
        }
    }

    if (!options.ast) return;

    const astJson = JSON.stringify(ast, null, 2);
    if (options.output) {
        const astOutputFile = options.output + '.ast.json';
        fs.writeFileSync(astOutputFile, astJson);
        console.error(`Babel AST saved to ${astOutputFile}`);
    } else if (options.verbose && !options.sandbox) {
        //console.log(astJson);
    }
}

async function writeJsOutput(jsCode, options) {
    if (options.pretty) {
        const prettier = require('prettier');
        jsCode = await prettier.format(jsCode, { parser: 'babel' });
    }
    if (!options.output) {
        if (options.verbose && !options.sandbox) {
            console.log(jsCode);
        }
        return;
    }

    fs.writeFileSync(options.output, jsCode);

    if (sourceMap) {
        fs.writeFileSync(`${options.output}.map`, JSON.stringify(sourceMap, null, 2));
    }

    if (!options.sandbox) {
        if (options.verbose) {
            console.error(`Output saved to ${options.output}`);
        } else {
            console.log(`Output saved to ${options.output}`);
        }
    }
}

function formatError(err, inputFile) {
    const loc = err && err.hash && err.hash.loc ? err.hash.loc : null;
    if (!loc) {
        return `Error: ${err.message}`;
    }

    // Jison columns are typically 0-based, convert to 1-based for users.
    const line = loc.first_line;
    const column = typeof loc.first_column === 'number' ? loc.first_column + 1 : undefined;
    const where = column ? `${inputFile}:${line}:${column}` : `${inputFile}:${line}`;
    return `Error at ${where}\n${err.message}`;
}

module.exports = {
    formatError,
    printAstIfRequested,
    validateInputFile,
    writeJsOutput,
};
