import * as fs from "fs";
import {ComparisonOperator, FunctionContainer, LexicalEnvironment, MathOperators, Syntax} from "./translator-types";
import {Instruction, OUTPUT_ADDRESS, Opcode} from "./byte-code";

const CLI_ARGS_COUNT = 4;
const INPUT_FILE_ARG_INDEX = 2;
const OUTPUT_FILE_ARG_INDEX = 3;

// Accept two arguments: input file and output file.
if(process.argv.length !== CLI_ARGS_COUNT) {
    console.log(`Usage: node ${ process.argv[1] } <input file> <output file>`);
    process.exit(1);
}
const input_file = process.argv[INPUT_FILE_ARG_INDEX];
const output_file = process.argv[OUTPUT_FILE_ARG_INDEX];

// Read the input file.
const input_data = fs.readFileSync(input_file, 'utf8');

const mappings: { [key: string]: FunctionContainer } = {}; // functions address mapping

const program = translate(input_data);
console.log(program, mappings, Object.values(mappings).flatMap(el => el.body));

program.push(...Object.values(mappings).flatMap(el => el.body));

fs.writeFileSync(output_file, program.map(instr => JSON.stringify(instr)).join("\n"), 'utf8');


// Translate the input file.
function translate(input_data: string): Instruction[] {
    const result: Instruction[] = [];

    const root: LexicalEnvironment = {
        parent: undefined,
        variables: []
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

    return result;
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
                parse_function_definition(expression, lexical_environment);
                break;
            case Syntax.SET:
                result.push(...parse_setq(input_data, lexical_environment));
                break;
            case Syntax.PRINT:
                result.push(...parse_print(expression, lexical_environment));
                break;
            default:
                if (match && mappings[match[0]] !== undefined)
                    result.push(...parse_call_function(match[0], cut_expression(input_data.substring(1 + match[0].length)).trim(), lexical_environment));
                break;
        }
    else if(cut_expression(input_data, false))
            result.push(...parse_math(input_data, lexical_environment));

    return result;
}

// eslint-disable-next-line max-statements
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
    return input_data.substring(save_brackets ? 0 : 1, index - +!save_brackets);
}

function expression_to_parts(input_data: string): { action: string, first: string, second: string, third?: string } {
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

    let second_expression = input_data.substring(action.length + 1 + first_expression.length + 1);
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


// eslint-disable-next-line max-lines-per-function,max-statements
function parse_function_definition(input_data: string, lexical_environment: LexicalEnvironment) {
    const environment: LexicalEnvironment = {
        parent: lexical_environment,
        variables: []
    };

    let offset = 1 + Syntax.FUNCTION.length + 1
    const name = match_or_throw(input_data.substring(offset), /^\w+/u, "Function must have name!")
    offset += name.length;

    let args = match_or_throw(input_data.substring(offset), /^\s*(\w+|\([^)]*\))\s*/u,
        "Function must have arguments expression in format '(a b c)' or 'a'!");
    offset += args.length;
    console.log("Define", `${name}|${args}|${input_data.substring(offset)}`);
    args = args.trim();
    if (args.startsWith("("))
        environment.variables.push(...args.substring(1, args.length - 1).split(" ").filter(el => !!el));
    else
        environment.variables.push(args);

    const body: Instruction[] = [];

    mappings[name] = {
        address: Object.keys(mappings).length,
        name,
        body
    };

    parse_body(input_data.substring(offset));
    if(environment.variables.length > 0){
        body.push(set_value(environment.variables[0], environment));
        body.push(...environment.variables.reverse().map(variable => ({
            line: 0,
            source: `pop function args ${variable}`,
            opcode: Opcode.POP,
            arg: 0
        })));
    }
    body.push({
        line: 0,
        source: `ret ${name}`,
        opcode: Opcode.RET,
        arg: 0
    });

    // console.log("Defined", name);

    function parse_body(input_body: string){
        if(input_body.startsWith(")"))
            throw new Error("Function must have body expression!");
        if (input_body.startsWith("((")) {
            body.push(...parse(input_body.substring(1), environment));
            // let i = 1 + body[body.length - 1].source.length;
            // while (input_data[i] != ")") {
            body.push(...parse(input_body, environment));
            throw new Error("Not implemented!"); // TODO
            // }
        } else {
            body.push(...parse(input_body, environment));
        }
    }
}


function parse_call_function(name: string, args: string, lexical_environment: LexicalEnvironment): Instruction[]{
    const result: Instruction[] = []

    console.log(`Call ${name} with args '${args}'`);
    if(!args.startsWith("("))
        throw new Error("Function call must have args expression!");

    if(args.startsWith("("))
        args = args.substring(1, args.length - 1);
    else
        throw new Error("Function call must have args expression!");

    if(MathOperators[args[0]]) {
        result.push(...parse_math(`(${args})`, lexical_environment));
        result.push({
            line: 0,
            source: `push (${args})`,
            opcode: Opcode.PUSH,
            arg: 0
        })
        return result
    }

    const variables = args.matchAll(/(\w+|\([^() ]+\))/igu);
    for(const variable of variables){
        console.log(variable);
        result.push(load_value(variable[0], lexical_environment));
        result.push({
            line: 0,
            source: `push ${variable[0]}`,
            opcode: Opcode.PUSH,
            arg: 0
        })
    }

    result.push({
        line: 0,
        source: `call ${name}`,
        opcode: Opcode.CALL,
        arg: {type: 'function', name}
    })

    return result;
}

function parse_math(input: string, lexical_environment: LexicalEnvironment): Instruction[] {
    const {action, first, second} = expression_to_parts(input);

    if (MathOperators[action] === undefined) return [];

    const result: Instruction[] = [];

    if (second.startsWith("("))
        result.push(...parse(second, lexical_environment));
    else
        result.push(load_value(second, lexical_environment));

    result.push({
        line: 0,
        source: `second math arg save ${second}`,
        opcode: Opcode.PUSH,
        arg: 0
    });

    if (first.startsWith("("))
        result.push(...parse(first, lexical_environment));
    else
        result.push(load_value(first, lexical_environment));

    result.push({
        line: 0,
        source: `second math arg load ${input}`,
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

// eslint-disable-next-line max-lines-per-function,max-statements
function parse_logical_expression(input: string, lexical_environment: LexicalEnvironment): [Instruction[], number | null] {
    const result: Instruction[] = [];

    const {action, first, second, third} = expression_to_parts(input);

    if(third !== undefined)
        throw new Error(`Too many arguments in logical expression, expected 3: ${input}`);

    let jmp: Instruction | null = null;
    if(ComparisonOperator[action] === undefined)
        throw new Error(`Invalid logical operator, expected one of [${Object.keys(ComparisonOperator).join(", ")}]: ${action}`);

    if (input.startsWith("(")) { // condition is an expression // TODO: add support for multiple expressions
        if (second.startsWith("("))
            result.push(...parse(second, lexical_environment));
        else
            result.push(load_value(second, lexical_environment, true));

        result.push({
            line: 0,
            source: `second logic arg save ${second}`,
            opcode: Opcode.PUSH,
            arg: 0
        });

        if(first.startsWith("("))
            result.push(...parse(first, lexical_environment));
        else
            result.push(load_value(first, lexical_environment)); // eslint-disable-next-line no-magic-numbers

        result.push({
            line: 0,
            source: `second logic arg load ${input}`,
            opcode: Opcode.CMP,
            arg: {addressing: 'stack', value: 0}
        },{
            line: 0,
            source: `second logic arg clear`,
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
            opcode: Opcode.JNZ,
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
// eslint-disable-next-line max-lines-per-function,max-statements
function parse_if(input_data: string, lexical_environment: LexicalEnvironment): Instruction[] {
    const result: Instruction[] = [];

    const {first, second, third} = expression_to_parts(input_data);

    if(!third)
        throw new Error("If statement always requires else branch");

    const [condition_code, jmp] = parse_logical_expression(first, lexical_environment);
    result.push(...condition_code);

    const positive_branch = parse_code_branch(second);
    result.push(...positive_branch);

    const positive_end_jmp: Instruction = {
        line: 0,
        source: "after pos if jmp",
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
                console.log(input);
                const expression = cut_expression(input);
                result.push(...parse(expression, lexical_environment));
                input = input.substring(expression.length);
            }
        } else // Single expression
            if(input.match(/^(\w|\d)+$/ui))
                result.push(load_value(input, lexical_environment));
            else
                result.push(...parse(`(${input})`, lexical_environment));

        // console.log("RES", result);

        return result;
    }
}


function load_value(variable: string, lexical_environment: LexicalEnvironment, compare_only: boolean = false): Instruction {
    if (isNaN(+variable))
        if (!lexical_environment.variables.includes(variable))
            throw new Error(`Variable ${variable} is not defined.`);
        else if (lexical_environment.parent)
            return {
                line: 0,
                source: `load ${variable}`,
                opcode: compare_only ? Opcode.CMP : Opcode.LD,
                arg: {type: 'stack', name: variable}
            }
        else
            return {
                line: 0,
                source: `load ${variable}`,
                opcode: compare_only ? Opcode.CMP : Opcode.LD,
                arg: {type: 'variable', name: variable}
            }
    else
        return {
            line: 0,
            source: `load direct ${variable}`,
            opcode: compare_only ? Opcode.CMP : Opcode.LD,
            arg: +variable
        }
}

function set_value(variable: string, lexical_environment: LexicalEnvironment): Instruction {
    if (isNaN(+variable))
        if (!lexical_environment.variables.includes(variable))
            throw new Error(`Variable ${variable} is not defined.`);
        else if (lexical_environment.parent)
            return {
                line: 0,
                source: `set ${variable}`,
                opcode: Opcode.ST,
                arg: {type: 'stack', name: variable}
            }
        else
            return {
                line: 0,
                source: `set ${variable}`,
                opcode: Opcode.ST,
                arg: {type: 'variable', name: variable}
            }
    else
        throw new Error(`Variable must string: ${variable}`);
}


function match_or_throw(text: string, regexp: RegExp, message?: string){
    const match = text.match(regexp);
    if(match)
        return match[0];
    throw new Error(message);
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

    result.push(set_value(first, lexical_environment));
    return result;
}

function parse_while(input: string, lexical_environment: LexicalEnvironment): Instruction[]{
    const result: Instruction[] = [];

    console.log(expression_to_parts(input));

    const {action, first, second} = expression_to_parts(input);
    const [condition, jmp] = parse_logical_expression(first, lexical_environment);

    result.push(...condition);

    const body: Instruction[] = [];
    if(second.startsWith("((")){
        let body_expressions = second.substring(1, second.length - 1);
        while (body_expressions) {
            const expression = cut_expression(body_expressions);
            body.push(...parse(expression, lexical_environment));
            body_expressions = body_expressions.substring(expression.length);
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