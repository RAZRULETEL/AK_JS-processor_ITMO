/* eslint-disable no-magic-numbers */

export const OUTPUT_ADDRESS = 1;
export const INPUT_ADDRESS = 2;

export interface Address{
    addressing: 'stack' | 'relative' | 'absolute';
    value: number;
}

export interface TargetAddress{
    type: 'variable' | 'function' | 'stack';
    name: string;
}

export enum Register {
    ACC = 0, // accumulator
    IP = 1, // instruction pointer
    SP = 2, // stack pointer
    BR = 3, // buffer register
    DR = 4, // data register | read-write from memory
    PR = 5, // program register
}

export enum Opcode {
    NOP = 0,
    PUSH = 1,
    POP = 2,
    ADD = 3,
    SUB = 4,
    MUL = 5,
    DIV = 6,
    MOD = 7,
    EQ = 8,
    NEQ = 9,
    GT = 10,
    LT = 11,
    GE = 12,
    LE = 13,
    JMP = 14,
    JZ = 15,
    JNZ = 16,
    CALL = 17,
    RET = 18,
    INC = 19,
    DEC = 20,
    CMP = 21,
    HALT = 22,
    LD = 23,
    ST = 24,
    FLUSH = 25, // increment SP
}

export interface Instruction {
    line: number;
    source: string;
    opcode: Opcode;
    arg: TargetAddress | Address | number;
}

export interface Data {
    value: number;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface MemoryCell {
    value: Instruction | Data;
    address: number;
}