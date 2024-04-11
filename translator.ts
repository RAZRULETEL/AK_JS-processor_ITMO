import {Instruction, Opcode} from "./byte-code";

const fs = require('fs');

enum Syntax {
    IF = "if",
    WHILE = "while",
    FUNCTION = "function",
    RETURN = "return",
    SET = "setq",
    PRINT = "print",
}

const ComparisonOperator = {
    "=": Opcode.EQ,
    "!=": Opcode.NEQ,
    "<": Opcode.LT,
    ">": Opcode.GT,
    "<=": Opcode.LE,
    ">=": Opcode.GE
}

const MathOperators = {
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
    parent: LexicalEnvironment | null;
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
    "          (if                 (>=   x     0) ()          (* x (factorial (- x 1))))) (function test(a b c)(print a)))"), mappings);

console.log(expression_to_parts("(>=   a     (                 print           a              )       )"));

// Translate the input file.
function translate(input_data: string): Instruction[] {
    const result: Instruction[] = [];

    const root: LexicalEnvironment = {
        parent: null,
        variables: ["x"]
    };


    input_data = input_data.trim();
    if (!input_data.startsWith("(") || !input_data.endsWith(")"))
        throw new Error("Invalid input file.");

    input_data = input_data.substring(1).trim();
    if(input_data.startsWith("(")){
        while (!input_data.match(/^(\)|\s)*\)$/)){
            const expression = cut_expression(input_data).trim();
            result.push(...parse(expression, root));
            input_data = input_data.substring(expression.length);
        }
    }else
        result.push(...parse(input_data, root));

    return result.concat(functions.flatMap(e => e));
}

function parse(input_data: string, lexical_environment: LexicalEnvironment): Instruction[] {
    console.log("Parse ", !!lexical_environment.parent);
    const match = input_data.substring(1).match(/^\s*\w+/);

    const expression = cut_expression(input_data);

    const result: Instruction[] = [];
    if(match)
    switch (match[0].trim()) {
        case Syntax.IF:
            result.push(...parse_if(expression, lexical_environment));
            break;
        case Syntax.WHILE:
            break;
        case Syntax.FUNCTION:
            if(lexical_environment.parent != null)
                throw new Error("Nested functions not supported!");
            function_definition(expression, lexical_environment);
            break;
        case Syntax.RETURN:
            break;
        case Syntax.SET:

            if(lexical_environment.variables.indexOf("") > 0)
            lexical_environment.variables.push();
            break;
        case Syntax.PRINT:
            break;
        default:
            if(match && mappings[match[0]] != undefined){
                result.push({
                    line: 0,
                    source: "call " + match[0],
                    opcode: Opcode.CALL,
                    arg: {type: 'function', name: match[0]}
                })
            }
            break;
    }
    else{
        result.push(...parse_math(input_data, lexical_environment));
    }
    return result;
}

function cut_expression(input_data: string, save_brackets: boolean = true): string {
    let lvl = 0;
    let i = 0;
    let is_string = false;
    do {
        let match;
        if (!is_string && (match = input_data.substring(i).match(/^\s+/))) {
            const is_bracket_close = input_data[i - 1] == "(" || input_data[i + match[0].length] == ")";
            input_data = input_data.substring(0, i) + input_data.substring(i + match[0].length + is_bracket_close - 1, input_data.length);
            (!is_bracket_close) && i++;
            continue;
        }
        if (input_data[i] == '"' || input_data[i] == "'")
            is_string = !is_string;

        if (!is_string && input_data[i] == "(")
            lvl++;

        if (!is_string && input_data[i] == ")")
            lvl--;

        i++;

        if (i > input_data.length)
            throw new Error("Expression not closed: " + input_data);
    } while (lvl > 0)
    return input_data.substring(save_brackets ? 0 : 1, i - +!save_brackets);
}

function expression_to_parts(input_data: string): { action: string, first: string, second: string, third?: string } {
    if (!input_data.startsWith("("))
        throw new Error("Expression must starts with '(': " + input_data);
    input_data = cut_expression(input_data, false);
    const action = input_data.split(" ", 1)[0];

    let first_expression = input_data.substring(action.length + 1);
    if (first_expression.startsWith("("))
        first_expression = cut_expression(first_expression);
    else
        first_expression = input_data.split(" ", 2)[1];

    let second_expression = input_data.substring(action.length + 1 + first_expression.length + 1);
    if (second_expression.startsWith("("))
        second_expression = cut_expression(second_expression);

    let third_expression = input_data.substring(action.length + 1 + first_expression.length + 1 + second_expression.length).trim();
    if (third_expression) {
        if (third_expression.startsWith("("))
            third_expression = cut_expression(third_expression);
    } else
        third_expression = undefined;


    return {action: action, first: first_expression, second: second_expression, third: third_expression};
}

function function_definition(input_data: string, lexical_environment: LexicalEnvironment) {
    const environment = {
        parent: lexical_environment,
        variables: []
    };

    let offset = 1 + Syntax.FUNCTION.length + 1
    const name = input_data.substring(offset).match(/^\w+/)[0];
    offset += name.length;

    console.log("Define", name);

    let args: string = input_data.substring(offset).match(/(\w+|\([^)]+\))/)[0];
    offset += args.length + 2;
    if (args.startsWith("(")) {
        environment.variables.push(...args.substring(1, args.length - 1).split(" "));
    } else {
        environment.variables.push(args);
    }

    mappings[name] = functions.length;

    const body: Instruction[] = [];
    if (input_data.substring(offset).startsWith("((")) {
        body.push(...parse(input_data.substring(offset + 1), environment));
        let i = 1 + body[body.length - 1].source.length;
        while (input_data[i] != ")") {
            body.push(...parse(input_data.substring(offset), environment));
            i += body[body.length - 1].source.length;
        }
    } else {
        body.push(...parse(input_data.substring(offset), environment));
    }
    body.push({
        line: 0,
        source: "ret " + name,
        opcode: Opcode.RET,
        arg: 0
    });

    functions.push(body);

    console.log("Defined", name);
}


function parse_math(input_data: string, lexical_environment: LexicalEnvironment): Instruction[] {
    let {action, first, second} = expression_to_parts(input_data);

    if (MathOperators[action] == undefined) return [];
    input_data = input_data.substring(1, input_data.length - 1);

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
function parse_if(input_data: string, lexical_environment: LexicalEnvironment): Instruction[]{
    const result: Instruction[] = [];
    const condition = input_data[4] != "(" ? input_data.substring(4).match(/^\w+/)[0] : cut_expression(input_data.substring(4));

    let jmp: Instruction;

    if (condition.startsWith("(")) { // condition is an expression
        const args = condition.substring(1, condition.length - 1).split(" ");
        if(args.length != 3)
            throw new Error("Invalid arguments count: " + args.length + ", expected 3.");
        if(ComparisonOperator[args[0]] == undefined)
            throw new Error("Invalid comparison operator: " + args[0]);
        result.push(load_value(args[1], lexical_environment));
        result.push(load_value(args[2], lexical_environment, true));
        jmp = {
            line: 0,
            source: "if jmp",
            opcode: ComparisonOperator[args[0]],
            arg: 0
        }
    } else { // condition is a variable or constant
        if(condition == "true" || condition == "false") {
            jmp = {
                line: 0,
                source: "",
                opcode: Opcode.JMP,
                arg: 0
            }
        }else {
            result.push(load_value(condition, lexical_environment));
            jmp = {
                line: 0,
                source: "",
                opcode: Opcode.JNZ,
                arg: 0
            }
        }
    }
    result.push(jmp);

    const jmp_index = result.length - 1;

    const positive = cut_expression(input_data.substring(5 + condition.length));
    const positive_branch = parse_code_branch(positive);
    result.push(...positive_branch);

    const positive_end_jmp: Instruction = {
        line: 0,
        source: "after pos if jmp",
        opcode: Opcode.JMP,
        arg: 0
    };
    result.push(positive_end_jmp);
    jmp.arg = { addressing: "relative", value: positive_branch.length + 1};

    const negative = cut_expression(input_data.substring(6 + condition.length + positive.length));
    const negative_branch = parse_code_branch(negative);
    result.push(...negative_branch);

    positive_end_jmp.arg = { addressing: "relative", value: negative_branch.length};

    return result;

    function parse_code_branch(input: string): Instruction[]{
        input = input.substring(1, input.length - 1);
        if(!input) return [];

        const result: Instruction[] = [];

        if(input.startsWith("(")){// Multiple expressions
            while (input.length > 0){
                console.log(input);
                const expression = cut_expression(input);
                result.push(...parse(expression, lexical_environment));
                input = input.substring(expression.length);
            }
        }else{// Single expression
            result.push(...parse(`(${input})`, lexical_environment));
        }

        // console.log("RES", result);

        return result;
    }
}



function load_value(variable: string, lexical_environment: LexicalEnvironment, compare_only: boolean = false): Instruction {
    if (isNaN(+variable))
        if (lexical_environment.variables.indexOf(variable) == -1)
            throw new Error("Variable " + variable + " is not defined.");
        else
            if(lexical_environment.parent == null)
                return {
                    line: 0,
                    source: "load " + variable,
                    opcode: compare_only ? Opcode.CMP : Opcode.LD,
                    arg: {type: 'variable', name: variable}
                }
            else
                return {
                    line: 0,
                    source: "load " + variable,
                    opcode: compare_only ? Opcode.CMP : Opcode.LD,
                    arg: {type: 'stack', name: variable}
                }
    else
        return {
            line: 0,
            source: "load direct " + variable,
            opcode: compare_only ? Opcode.CMP : Opcode.LD,
            arg: +variable
        }
}