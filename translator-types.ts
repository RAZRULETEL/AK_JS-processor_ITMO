import {Data, Instruction, Opcode} from "./byte-code";


export enum Syntax {
    IF = "if",
    WHILE = "while",
    FUNCTION = "function",
    RETURN = "return",
    SET = "setq",
    PRINT = "print",
}

export const ComparisonOperator: { [key: string]: Opcode } = {
    "=": Opcode.JNZ,
    "!=": Opcode.JZ,
    "<": Opcode.GE,
    ">": Opcode.LE,
    "<=": Opcode.GT,
    ">=": Opcode.LT
}

export const MathOperators: { [key: string]: Opcode } = {
    "+": Opcode.ADD,
    "-": Opcode.SUB,
    "*": Opcode.MUL,
    "/": Opcode.DIV,
    "%": Opcode.MOD,
}

/**
 * Environment that contains accessible variables and parent environment
 * Have functional visibility - new function => new environment
 */
export interface LexicalEnvironment {
    parent?: LexicalEnvironment;
    variables: string[];
    // eslint-disable-next-line no-use-before-define
    functions: FunctionContainer[];
}

export interface FunctionContainer {
    address: number
    name: string;
    body: Instruction[];
    lexical_environment: LexicalEnvironment;
}

export interface SourceProgram {
    output: number,
    input: number,
    program: Array<Instruction | Data>,
}