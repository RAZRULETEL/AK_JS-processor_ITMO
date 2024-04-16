import {Instruction, Opcode} from "./byte-code";


export enum Syntax {
    IF = "if",
    WHILE = "while",
    FUNCTION = "function",
    RETURN = "return",
    SET = "setq",
    PRINT = "print",
}

export const ComparisonOperator: { [key: string]: Opcode } = {
    "=": Opcode.EQ,
    "!=": Opcode.NEQ,
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
    "%": Opcode.DIV,
}

/**
 * Environment that contains accessible variables and parent environment
 * Have functional visibility - new function => new environment
 */
export interface LexicalEnvironment {
    parent?: LexicalEnvironment;
    variables: string[];
}

export interface FunctionContainer {
    address: number
    name: string;
    body: Instruction[];
}