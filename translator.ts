import * as fs from "fs";
import {
    ComparisonOperator,
    FunctionContainer,
    LexicalEnvironment,
    MathOperators,
    SourceProgram,
    Syntax
} from "./translator-types";
import {Data, Instruction, Opcode} from "./byte-code";

const CLI_ARGS_COUNT = 4;
const INPUT_FILE_ARG_INDEX = 2;
const OUTPUT_FILE_ARG_INDEX = 3;

const OUTPUT_ADDRESS = 1;
const INPUT_ADDRESS = 2;

// Accept two arguments: input file and output file.
if(process.argv.length === CLI_ARGS_COUNT) {
    const input_file = process.argv[INPUT_FILE_ARG_INDEX];
    const output_file = process.argv[OUTPUT_FILE_ARG_INDEX];

    translate_file(input_file, output_file);
}else
    if(process.argv[1].endsWith("translator.js")) {
        console.error(`Usage: node ${process.argv[1]} <input file> <output file>`);
        process.exit(1);
    }


export function translate_file(input_file: string, output_file: string) {

    if(fs.existsSync(input_file)) {
        const input_data = fs.readFileSync(input_file, 'utf8');

        const program = translate(input_data);

        const output: SourceProgram = {
            output: OUTPUT_ADDRESS,
            input: INPUT_ADDRESS,
            program,
        };

        fs.writeFileSync(output_file, JSON.stringify(output), 'utf8');
    }else {
        console.error(`Input file ${ input_file } does not exists!`);
        process.exit(1);
    }
}


function translate(input_data: string): (Instruction | Data)[] {
    const result: Instruction[] = [];

    const root: LexicalEnvironment = {
        parent: undefined,
        variables: [],
        functions: [],
    };

    try {
        input_data = cut_expression(input_data.trim(), false);
    } catch (err) {
        throw new Error(`Invalid input file.\n${(err as Error).message}`);
    }

    if (input_data.startsWith("(")) {
        while (input_data) {
            const expression = cut_expression(input_data);
            result.push(...parse(expression, root));
            input_data = input_data.substring(expression.length).trim();
        }
    } else
        result.push(...parse(input_data, root));

    return post_process(result, root);
}

// eslint-disable-next-line max-lines-per-function
function post_process(program: Instruction[], lexical_environment: LexicalEnvironment): (Instruction | Data)[]{
    const result: (Instruction | Data)[] = [{
        line: 0,
        source: "",
        opcode: Opcode.JMP,
        arg: {addressing: 'relative', value: lexical_environment.variables.length + 1 + 1}
    }, {value: OUTPUT_ADDRESS}, {value: INPUT_ADDRESS}
        , ...lexical_environment.variables.map(() => ({value: 0}))
    ];
    const variables_offset = result.length - lexical_environment.variables.length

    program.push({
        line: 0,
        source: "",
        opcode: Opcode.HALT,
        arg: 0
    });

    const mappings: {[key: string]: number} = {};

    const start = result.length + program.length;
    let offset = 0;
    for(const func of lexical_environment.functions) {
        func.address = start + offset;
        mappings[func.name] = func.address;
        offset += func.body.length;
    }


    for (const instruction of program.concat(...lexical_environment.functions.flatMap(el => el.body))) {
        if(typeof instruction.arg === 'object' && 'type' in instruction.arg) {
            const arg = instruction.arg;
            if(arg.type === 'variable') {
                instruction.arg = {
                    addressing: 'absolute',
                    value: lexical_environment.variables.indexOf(arg.name) + variables_offset
                }
            }
            if(arg.type === 'function') {
                instruction.arg = {
                    addressing: 'absolute',
                    value: mappings[arg.name] - 1
                }
            }
        }
    }

    post_process_function_variables(lexical_environment.functions);

    return result.concat(program, ...lexical_environment.functions.flatMap(el => el.body));
}

function post_process_function_variables(functions: FunctionContainer[]) {
    for (const func of functions) {
        let stack_offset = 1; // call pushes return address
        for (const instruction of func.body) {
            if (instruction.opcode === Opcode.PUSH)
                stack_offset++;
            if (instruction.opcode === Opcode.POP || instruction.opcode === Opcode.FLUSH)
                stack_offset--;
            if (typeof instruction.arg === 'object' && 'type' in instruction.arg)
                if (instruction.arg.type === 'stack') {
                    instruction.arg = {
                        addressing: 'stack',
                        value: func.lexical_environment.variables.reverse().indexOf(instruction.arg.name) + stack_offset
                    }
                }
        }
    }
}

function parse(input_data: string, lexical_environment: LexicalEnvironment): Instruction[] {
    console.log("Parse ", !!lexical_environment.parent, input_data);
    if (!input_data.trim()) return [];
    const match = input_data.substring(1).match(/^\s*\w+/u);

    const expression = cut_expression(input_data);

    const result: Instruction[] = [];
    if (match)
        switch (match[0].trim()) {
            case Syntax.IF:
                result.push(...parse_if(expression, lexical_environment));
                break;
            case Syntax.WHILE:
                result.push(...parse_while(input_data, lexical_environment));
                break;
            case Syntax.FUNCTION:
                if (lexical_environment.parent)
                    throw new Error("Nested functions not supported!");
                lexical_environment.functions.push(parse_function_definition(expression, lexical_environment));
                break;
            case Syntax.SET:
                result.push(...parse_setq(input_data, lexical_environment));
                break;
            case Syntax.PRINT:
                result.push(...parse_print(expression, lexical_environment));
                break;
            default:
                if (match && lexical_environment.functions.map(el => el.name).includes(match[0]) !== undefined)
                    result.push(...parse_call_function(match[0], cut_expression(input_data.substring(1 + match[0].length)), lexical_environment));
                break;
        }
    else if(cut_expression(input_data, false))
            result.push(...parse_math(input_data, lexical_environment));

    return result;
}

function cut_expression(input_data: string, save_brackets: boolean = true): string {
    let lvl = 0;
    let index: number = 0;
    let is_string = false;
    while (input_data[index] === ' ') index++;
    do {
        let match: RegExpMatchArray | null = null;
        if (!is_string && (match = input_data.substring(index).match(/^\s+/u))) {
            const is_bracket_close = input_data[index - 1] === "(" || input_data[index + match[0].length] === ")";
            input_data = input_data.substring(0, index) + input_data.substring(index + match[0].length + +is_bracket_close - 1, input_data.length);
            if(!is_bracket_close)
                index++;
            continue;
        }
        if (input_data[index] === '"' || input_data[index] === "'")
            is_string = !is_string;

        if (!is_string && input_data[index] === "(")
            lvl++;

        if (!is_string && input_data[index] === ")")
            lvl--;

        index++;

        if (index > input_data.length)
            throw new Error(`Expression not closed: ${input_data}`);
    } while (lvl > 0)
    return input_data.substring(save_brackets ? 0 : 1, index - +!save_brackets).trim();
}

function expression_to_parts(input_data: string): { action: string, first: string, second: string, third?: string } {
    input_data = input_data.trim();
    if (!input_data.startsWith("("))
        throw new Error(`Expression must starts with '(': ${  input_data}`);
    input_data = cut_expression(input_data, false);
    if(!input_data)
        throw new Error("Expression cannot be empty!");
    const action = input_data.split(" ", 1)[0];

    let first_expression = input_data.substring(action.length + 1);
    if (first_expression.startsWith("("))
        first_expression = cut_expression(first_expression);
    else
        first_expression = input_data.split(" ")[1];

    let second_expression = input_data.substring(action.length + 1 + first_expression.length).trim();
    if (second_expression.startsWith("("))
        second_expression = cut_expression(second_expression);
    else
        second_expression = second_expression.split(" ")[0];

    let third_expression: string | undefined = input_data.substring(action.length + 1 + first_expression.length + 1 + second_expression.length).trim();
    if (third_expression) {
        if (third_expression.startsWith("("))
            third_expression = cut_expression(third_expression);
    } else
        third_expression = undefined;


    return {action, first: first_expression, second: second_expression, third: third_expression};
}



function parse_function_definition(input_data: string, lexical_environment: LexicalEnvironment): FunctionContainer {
    const container: FunctionContainer = {
        address: 0,
        name: "",
        body: [],
        lexical_environment: {
            parent: lexical_environment,
            variables: [],
            functions: []
        }
    };

    let offset = 1 + Syntax.FUNCTION.length + 1
    const name = match_or_throw(input_data.substring(offset), /^\w+/u, "Function must have name!")
    offset += name.length;

    container.name = name;

    let args = match_or_throw(input_data.substring(offset), /^\s*(\w+|\([^)]*\))\s*/u,
        "Function must have arguments expression in format '(a b c)' or 'a'!");
    offset += args.length;
    console.log("Define", `${name}|${args}|${input_data.substring(offset)}`);
    args = args.trim();
    if (args.startsWith("("))
        container.lexical_environment.variables.push(...args.substring(1, args.length - 1).split(" ").filter(el => !!el));
    else
        container.lexical_environment.variables.push(args);

    const body: Instruction[] = container.body;

    body.push(...parse_function_body(input_data.substring(offset), container.lexical_environment));
    if(container.lexical_environment.variables.length > 0){
        body.push(set_value(container.lexical_environment.variables[0], container.lexical_environment));
    }
    body.push({
        line: 0,
        source: `ret ${name}`,
        opcode: Opcode.RET,
        arg: 0
    });

    return container;
}

function parse_function_body(input_body: string, lexical_environment: LexicalEnvironment): Instruction[]{
    const body: Instruction[] = [];
    if(input_body.startsWith(")"))
        throw new Error("Function must have body expression!");
    if (input_body.startsWith("((")) {
        let body_expressions = input_body.substring(1, input_body.length - 1).trim();
        while (body_expressions) {
            const expression = cut_expression(body_expressions);
            body.push(...parse(expression, lexical_environment));
            body_expressions = body_expressions.substring(expression.length).trim();
        }
    } else {
        body.push(...parse(input_body, lexical_environment));
    }
    return body;
}

// eslint-disable-next-line max-lines-per-function
function parse_call_function(name: string, args: string, lexical_environment: LexicalEnvironment): Instruction[]{
    const result: Instruction[] = []

    console.log(`Call ${name} with args '${args}'`);
    if(!args.startsWith("("))
        throw new Error("Function call must have args expression!");

    if(args.startsWith("("))
        args = args.substring(1, args.length - 1);
    else
        throw new Error("Function call must have args expression!");

    let args_count = 0;
    if(args)
        if(MathOperators[args[0]]) {
            result.push(...parse_math(`(${args})`, lexical_environment));
            result.push({
                line: 0,
                source: `(${args})`,
                opcode: Opcode.PUSH,
                arg: 0
            });
            args_count = 1;
        }else{
            const variables = args.matchAll(/(\w+|\([^() ]+\))/igu);
            for (const variable of variables) {
                result.push(load_value(variable[0], lexical_environment));
                result.push({
                    line: 0,
                    source: variable[0],
                    opcode: Opcode.PUSH,
                    arg: 0
                });
                args_count++;
            }
        }

    result.push({
        line: 0,
        source: `(${name} (${args}))`,
        opcode: Opcode.CALL,
        arg: {type: 'function', name}
    })

    for(let index = 0; index < args_count; index++)
        result.push({
            line: 0,
            source: `arg clear ${args}`,
            opcode: Opcode.POP,
            arg: 0
        })

    return result;
}

function parse_math(input: string, lexical_environment: LexicalEnvironment): Instruction[] {
    const {action, first, second} = expression_to_parts(input);

    if (MathOperators[action] === undefined) return [];

    const result: Instruction[] = [];

    result.push(...parse_or_load(second, lexical_environment));

    result.push({
        line: 0,
        source: second,
        opcode: Opcode.PUSH,
        arg: 0
    });

    result.push(...parse_or_load(first, lexical_environment));

    result.push({
        line: 0,
        source: input,
        opcode: MathOperators[action],
        arg: {addressing: 'stack', value: 0}
    },{
        line: 0,
        source: `second math arg clear`,
        opcode: Opcode.FLUSH,
        arg: 0
    })


    return result;
}


// eslint-disable-next-line max-lines-per-function
function parse_logical_expression(input: string, lexical_environment: LexicalEnvironment): [Instruction[], number | null] {
    const result: Instruction[] = [];

    const {action, first, second, third} = expression_to_parts(input);

    if(third !== undefined)
        throw new Error(`Too many arguments in logical expression, expected 3: ${input}`);

    let jmp: Instruction | null = null;
    if(ComparisonOperator[action] === undefined)
        throw new Error(`Invalid logical operator, expected one of [${Object.keys(ComparisonOperator).join(", ")}]: ${action}`);

    if (input.startsWith("(")) { // condition is an expression
        result.push(...parse_or_load(second, lexical_environment));

        result.push({
            line: 0,
            source: second,
            opcode: Opcode.PUSH,
            arg: 0
        });

        result.push(...parse_or_load(first, lexical_environment));

        result.push({
            line: 0,
            source: input,
            opcode: Opcode.CMP,
            arg: {addressing: 'stack', value: 0}
        },{
            line: 0,
            source: input,
            opcode: Opcode.FLUSH,
            arg: 0
        })

        jmp = {
            line: 0,
            source: input,
            opcode: ComparisonOperator[action],
            arg: 0
        }
    } else // condition is a variable or constant
    if (input === "false") {
        jmp = {
            line: 0,
            source: input,
            opcode: Opcode.JMP,
            arg: 0
        }
    } else if (input === "true") {
        jmp = null;
    } else {
        result.push(load_value(input, lexical_environment));
        jmp = {
            line: 0,
            source: input,
            opcode: Opcode.JZ,
            arg: 0
        }
    }

    return [result, jmp && result.push(jmp) - 1];
}


/**
 * Parses 'if' expressions of next template 'if (> x y) (expression) (expression)' or 'if x (expression) (expression)'
 * @param input_data
 * @param lexical_environment
 */
function parse_if(input_data: string, lexical_environment: LexicalEnvironment): Instruction[] {
    const result: Instruction[] = [];

    const {action, first, second, third} = expression_to_parts(input_data);
    if(!third)
        throw new Error("If statement always requires else branch");

    const [condition_code, jmp] = parse_logical_expression(first, lexical_environment);
    result.push(...condition_code);

    const positive_branch = parse_code_branch(second);
    result.push(...positive_branch);

    const positive_end_jmp: Instruction = {
        line: 0,
        source: `(${action} ${first})`,
        opcode: Opcode.JMP,
        arg: 0
    };
    result.push(positive_end_jmp);
    if(jmp)
        condition_code[jmp].arg = {addressing: "relative", value: positive_branch.length + 1};

    const negative_branch = parse_code_branch(third);
    result.push(...negative_branch);

    positive_end_jmp.arg = {addressing: "relative", value: negative_branch.length};

    return result;

    function parse_code_branch(input: string): Instruction[] {
        input = input.substring(1, input.length - 1);
        if (!input) return [];

        const result: Instruction[] = [];
        if (input.startsWith("(")) {// Multiple expressions
            while (input.length > 0) {
                const expression = cut_expression(input);
                result.push(...parse(expression, lexical_environment));
                input = input.substring(expression.length);
            }
        } else // Single expression
            if(input.match(/^(\w|\d)+$/ui))
                result.push(load_value(input, lexical_environment));
            else
                result.push(...parse(`(${input})`, lexical_environment));

        return result;
    }
}

function parse_setq(input: string, lexical_environment: LexicalEnvironment): Instruction[] {
    const result: Instruction[] = [];

    const {first, second} = expression_to_parts(input);
    if(!first.match(/^\w(\w|\d)*$/ui))
        throw new Error(`Invalid variable name: ${first}`);

    if(second.startsWith("("))
        result.push(...parse(second, lexical_environment));
    else
        result.push(load_value(second, lexical_environment));

    if(!lexical_environment.variables.includes(first))
        lexical_environment.variables.push(first)

    result.push(set_value(first, lexical_environment, input));
    return result;
}

function parse_while(input: string, lexical_environment: LexicalEnvironment): Instruction[]{
    const result: Instruction[] = [];

    const {action, first, second} = expression_to_parts(input);
    const [condition, jmp] = parse_logical_expression(first, lexical_environment);

    result.push(...condition);

    const body: Instruction[] = [];
    if(second.startsWith("((")){
        let body_expressions = second.substring(1, second.length - 1).trim();
        while (body_expressions) {
            const expression = cut_expression(body_expressions);
            body.push(...parse(expression, lexical_environment));
            body_expressions = body_expressions.substring(expression.length).trim();
        }
    }else
        body.push(...parse(second, lexical_environment));

    if(jmp)
        condition[jmp].arg = {addressing: "relative", value: body.length + 1};

    result.push(...body, {
        line: 0,
        source: `${action} ${first}`,
        opcode: Opcode.JMP,
        arg: {addressing: "relative", value: -body.length - 1 - condition.length}
    });

    return result
}

function parse_print(input: string, lexical_environment: LexicalEnvironment): Instruction[] {
    const result: Instruction[] = [];

    const {first} = expression_to_parts(input);

    if(first.startsWith("(")){
        const expression = cut_expression(first);
        result.push(...parse(expression, lexical_environment));
    }else
        result.push(load_value(first, lexical_environment));

    result.push({
        line: 0,
        source: input,
        opcode: Opcode.ST,
        arg: {addressing: 'absolute', value: OUTPUT_ADDRESS}
    });

    return result
}

function parse_or_load(input: string, lexical_environment: LexicalEnvironment): Instruction[] {
    if (input.startsWith("("))
        return  parse(input, lexical_environment);
    return [load_value(input, lexical_environment)];
}

function load_value(variable: string, lexical_environment: LexicalEnvironment, compare_only: boolean = false): Instruction {
    if (isNaN(+variable) && !variable.startsWith("'"))
        if (!lexical_environment.variables.includes(variable))
            throw new Error(`Variable ${variable} is not defined.`);
        else if (lexical_environment.parent)
            return {
                line: 0,
                source: variable,
                opcode: compare_only ? Opcode.CMP : Opcode.LD,
                arg: {type: 'stack', name: variable}
            }
        else
            return {
                line: 0,
                source: variable,
                opcode: compare_only ? Opcode.CMP : Opcode.LD,
                arg: {type: 'variable', name: variable}
            }
    else {
        let value = +variable;
        if (variable.startsWith("'")) {
            if (!variable.endsWith("'"))
                throw new Error(`Literal not closed: ${variable}`);
            if (variable.substring(1, variable.length - 1).length !== 1)
                throw new Error(`Invalid literal length ${variable.length - 1 - 1}, expected 1: ${variable}`);
            value = variable.charCodeAt(1);
        }
        return {
            line: 0,
            source: variable,
            opcode: compare_only ? Opcode.CMP : Opcode.LD,
            arg: value
        }
    }
}

function set_value(variable: string, lexical_environment: LexicalEnvironment, source: string = ""): Instruction {
    if (isNaN(+variable))
        if (!lexical_environment.variables.includes(variable))
            throw new Error(`Variable ${variable} is not defined.`);
        else if (lexical_environment.parent)
            return {
                line: 0,
                source,
                opcode: Opcode.ST,
                arg: {type: 'stack', name: variable}
            }
        else
            return {
                line: 0,
                source,
                opcode: Opcode.ST,
                arg: {type: 'variable', name: variable}
            }
    else
        throw new Error(`Variable must be string: ${variable}`);
}


function match_or_throw(text: string, regexp: RegExp, message?: string){
    const match = text.match(regexp);
    if(match)
        return match[0];
    throw new Error(message);
}
