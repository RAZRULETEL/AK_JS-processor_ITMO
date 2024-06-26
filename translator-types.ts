import {Data, Instruction, Opcode} from "./byte-code";

export interface TargetAddress{
    type: 'variable' | 'function' | 'stack' | 'string';
    name: string;
}

export enum Syntax {
    IF = "if",
    WHILE = "while",
    FUNCTION = "function",
    SET = "setq",
    PRINT = "print",
    PRINT_CHAR = "printc", // Doesn't convert value to ASCII
    READ = "read",
    READ_STRING = "read-line",
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

interface Variable {
    name: string;
    type: 'int' | 'string' | 'allocation';
    length?: number;
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