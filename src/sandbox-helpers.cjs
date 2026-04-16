// V8 is the JavaScript engine used by Node.js. It provides the 'vm' module to create and manage V8 contexts, 
// allowing us to execute code in a sandboxed environment. This is useful for running untrusted code or code 
// that we want to isolate from the main execution context.
// vm is a library providing APIs to compile and run code within V8 contexts.
// V8 contexts are created. Each context has: its own global object, its own scope chain. 
// Code is compiled to V8 bytecode. Execution happens inside that context. 
// Important: contexts share the same V8 isolate, meaning: same heap, same event loop, same native bindings
const vm = require('vm');
const { SourceMapConsumer } = loadSourceMapPackage();

function loadSourceMapPackage() {
    try {
        return require('source-map');
    } catch (err) {
        return require('source-map-support/node_modules/source-map');
    }
}

/**
 * Escapes special characters in a string so that it can be safely used in a regular expression. 
 * This is used to escape the generated filename when searching for it in stack traces.
 * @param {*} text 
 * @returns 
 */
function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extracts line/column from a runtime stack trace for a specific generated filename.
 * In this CLI flow, the VM filename is `${inputFile}.js`, so matching is done against that.
 * @param {string} stackText - The runtime stack trace text.
 * @param {string} filename - The generated filename to search for in stack frames.
 * @returns {Object|null} - The location object or null if not found.
 */
function extractLocationFromStack(stackText, filename) {
    if (!stackText) return null;
    const escaped = escapeRegExp(filename);
    const match = stackText.match(new RegExp(`${escaped}:(\\d+)(?::(\\d+))`)); // Second par is not optional!
    if (!match) return null;
    return {
        line: parseInt(match[1], 10),
        column: match[2] ? parseInt(match[2], 10) : 1,
    };
}

/**
 * If the --ast option is enabled, prints the Babel AST in JSON format. If an output file is specified,
 * saves the AST to a .ast.json file alongside the generated JavaScript.
 * @param {} sourceMap - The source map generated during code generation, if available. This is not used for AST printing but is included for potential future use.
 * @param {} generatedLocation - The location in the generated code corresponding to the AST, if available
 *  This is not used for AST printing but is included for potential future use.
 * @returns 
 */
function originalLocationFor(sourceMap, generatedLocation) {
    if (!sourceMap || !generatedLocation) return null;

    const generatedColumn = Math.max(generatedLocation.column - 1, 0);
    const consumer = new SourceMapConsumer(sourceMap);

    try {
        let lower = null;
        let upper = null;

        consumer.eachMapping((mapping) => {
            if (mapping.generatedLine !== generatedLocation.line) return;

            if (mapping.generatedColumn <= generatedColumn) {
                if (!lower || mapping.generatedColumn > lower.generatedColumn) {
                    lower = mapping;
                }
            }

            if (mapping.generatedColumn >= generatedColumn) {
                if (!upper || mapping.generatedColumn < upper.generatedColumn) {
                    upper = mapping;
                }
            }
        });

        const mapping = lower || upper;
        if (!mapping || !mapping.source || !mapping.originalLine) return null;

        return {
            source: mapping.source,
            line: mapping.originalLine,
            column: typeof mapping.originalColumn === 'number' ? mapping.originalColumn + 1 : 1,
        };
    } finally {
        if (typeof consumer.destroy === 'function') {
            consumer.destroy();
        }
    }
}

/**
 * Formats a runtime error message with location information.
 * @param {*} err - The error thrown during sandbox execution.
 * @param {*} inputFile 
 * @returns {string} - The formatted error message including the location in the generated code if available.
 */
function formatSandboxRuntimeError(err, inputFile, sourceMap = null) {
    const lines = [`Error: ${err.message}`];
    const jsFile = `${inputFile}.js`;
    const where = extractLocationFromStack(err && err.stack, jsFile);

    if (where) {
        const original = originalLocationFor(sourceMap, where);
        if (original) {
            lines.push(`At source ${original.source}:${original.line}:${original.column}`);
        }
        lines.push(`At generated code ${jsFile}:${where.line}:${where.column}`);
    }

    return lines.join('\n');
}

/**
 * Executes generated JavaScript code in a sandboxed context.
 * @param {*} jsCode 
 * @param {*} inputFile 
 * @param {*} param2 
 */
function executeInSandbox(jsCode, inputFile, { verbose = false } = {}) {
    const sandbox = {
        console: {
            log: (...args) => console.log(...args),
        },
    };

    // Check whether the Node.js runtime supports native source map functionality and, 
    // if available, enable it for the current process.
    if (typeof process.setSourceMapsEnabled === 'function') {
        process.setSourceMapsEnabled(true);
    }

    if (verbose) {
        console.error(`Executing generated JavaScript for ${inputFile}.js`);
    }

    vm.runInNewContext(jsCode, sandbox, {
        filename: `${inputFile}.js`,
        displayErrors: true,
    });
}

/** 
 * Runs the given JavaScript code in a sandboxed environment and returns an object indicating success or failure.
 */
function runSandboxWithDiagnostics(jsCode, inputFile, { verbose = false, sourceMap = null } = {}) {
    try {
        executeInSandbox(jsCode, inputFile, { verbose });
        return { ok: true };
    } catch (err) {
        return {
            ok: false,
            message: formatSandboxRuntimeError(err, inputFile, sourceMap),
            stack: verbose ? err.stack : null,
        };
    }
}

module.exports = {
    executeInSandbox,
    extractLocationFromStack,
    formatSandboxRuntimeError,
    originalLocationFor,
    runSandboxWithDiagnostics,
};
