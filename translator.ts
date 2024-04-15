import {Instruction, Opcode} from "./byte-code";

// import * as fs from "fs";

const IF_ARGS_COUNT = 3;

enum Syntax {
    IF = "if",
    WHILE = "while",
    FUNCTION = "function",
    RETURN = "return",
    SET = "setq",
    PRINT = "print",
}

const ComparisonOperator: { [key: string]: Opcode } = {
    "=": Opcode.EQ,
    "!=": Opcode.NEQ,
    "<": Opcode.LT,
    ">": Opcode.GT,
    "<=": Opcode.LE,
    ">=": Opcode.GE
}

const MathOperators: { [key: string]: Opcode } = {
    "+": Opcode.ADD,
    "-": Opcode.SUB,
    "*": Opcode.MUL,
    "/": Opcode.DIV,
    "%": Opcode.DIV,
}

/**
 * Environment that contains accessible variables and parent environment
 * Have functional visibility - new function => new environment
 */
interface LexicalEnvironment {
    parent?: LexicalEnvironment;
    variables: string[];
}

// Accept two arguments: input file and output file.
// if(process.argv.length != 4) {
//     console.log("Usage: node " + process.argv[1] +" <input file> <output file>");
//     process.exit(1);
// }
// const input_file = process.argv[2];
// const output_file = process.argv[3];

// Read the input file.
// const input_data = fs.readFileSync(input_file, 'utf8');

const mappings: { [key: string]: number } = {}; // functions address mapping
const functions: Instruction[][] = [];

console.log(translate("((                  function                  factorial (x     h     k)" +
    "          (if                 (>=   x     0) 1          (* x (factorial (- x 1))))) (function test(a b c)(print a)) (function ter()()))"), mappings);

// Translate the input file.
function translate(input_data: string): Instruction[] {
    const result: Instruction[] = [];

    const root: LexicalEnvironment = {
        parent: undefined,
        variables: ["x"]
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

    return result.concat(functions.flatMap(elem => elem));
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
                break;
            case Syntax.FUNCTION:
                if (lexical_environment.parent)
                    throw new Error("Nested functions not supported!");
                parse_function_definition(expression, lexical_environment);
                break;
            case Syntax.RETURN:
                break;
            case Syntax.SET:

                if (lexical_environment.variables.indexOf("") > 0)
                    lexical_environment.variables.push();
                break;
            case Syntax.PRINT:
                break;
            default:
                if (match && mappings[match[0]] !== undefined) {

                    result.push({
                        line: 0,
                        source: `call ${  match[0]}`,
                        opcode: Opcode.CALL,
                        arg: {type: 'function', name: match[0]}
                    })
                }
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


    mappings[name] = functions.length;

    const body: Instruction[] = [];
    parse_body(input_data.substring(offset));
    if(environment.variables.length > 0){
        body.push(set_value(environment.variables[0], environment));
        body.push(...environment.variables.map(variable => ({
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

    functions.push(body);

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


function parse_math(input_data: string, lexical_environment: LexicalEnvironment): Instruction[] {
    const {action, first, second} = expression_to_parts(input_data);

    if (MathOperators[action] === undefined) return [];

    const result: Instruction[] = [];

    if (first.startsWith("("))
        result.push(...parse(first, lexical_environment));
    else
        result.push(load_value(first, lexical_environment));

    result.push({
        line: 0,
        source: "",
        opcode: Opcode.PUSH,
        arg: 0
    });

    if (second.startsWith("("))
        result.push(...parse(second, lexical_environment));
    else
        result.push(load_value(second.split(" ", 1)[0], lexical_environment));

    result.push({
        line: 0,
        source: "",
        opcode: Opcode.POP,
        arg: 0
    });

    return result;
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
    const condition = first;

    if(!third)
        throw new Error("If statement always requires else branch");

    let jmp: Instruction | null = null;

    if (condition.startsWith("(")) { // condition is an expression
        const args = condition.substring(1, condition.length - 1).split(" ");
        if (args.length !== IF_ARGS_COUNT)
            throw new Error(`Invalid arguments count: ${args.length}, expected 3.`);
        if (ComparisonOperator[args[0]] === undefined)
            throw new Error(`Invalid comparison operator: ${args[0]}`);
        result.push(load_value(args[1], lexical_environment)); // eslint-disable-next-line no-magic-numbers
        result.push(load_value(args[2], lexical_environment, true));
        jmp = {
            line: 0,
            source: "if jmp",
            opcode: ComparisonOperator[args[0]],
            arg: 0
        }
    } else // condition is a variable or constant
        if (condition === "false") {
            jmp = {
                line: 0,
                source: "",
                opcode: Opcode.JMP,
                arg: 0
            }
        } else if (condition === "true") {
            jmp = null;
        } else {
            result.push(load_value(condition, lexical_environment));
            jmp = {
                line: 0,
                source: "",
                opcode: Opcode.JNZ,
                arg: 0
            }
        }

    if(jmp)
        result.push(jmp);

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
        jmp.arg = {addressing: "relative", value: positive_branch.length + 1};

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
        } else {// Single expression
            result.push(...parse(`(${input})`, lexical_environment));
        }

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