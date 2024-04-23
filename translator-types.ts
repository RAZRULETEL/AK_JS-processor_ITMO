import {Data, Instruction, Opcode} from "./byte-code";


export enum Syntax {
    IF = "if",
    WHILE = "while",
    FUNCTION = "function",
    SET = "setq",
    PRINT = "print",
}

export const ComparisonOperator: { [key: string]: Opcode } = {
    "=": Opcode.JNZ,
    "!=": Opcode.JZ,
    "<": Opcode.LT,
    ">": Opcode.GT,
    "<=": Opcode.LE,
    ">=": Opcode.GE
}

export const MathOperators: { [key: string]: Opcode } = {
    "+": Opcode.ADD,
    "-": Opcode.SUB,
    "*": Opcode.MUL,
    "/": Opcode.DIV,
    "%": Opcode.MOD,
}

interface Variable {
    name: string;
    type: 'int' | 'string';
}

/**
 * Environment that contains accessible variables and parent environment
 * Have functional visibility - new function => new environment
 */
export interface LexicalEnvironment {
    parent?: LexicalEnvironment;
    variables: Variable[];
    /* eslint-disable-next-line no-use-before-define */// cyclic dependence with FunctionContainer
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

export interface ProgramTemplate {
    program: Array<Instruction | Data>,
    variables_offset: number,
    program_offset: number,
    functions_offset: number,
}