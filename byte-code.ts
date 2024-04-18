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
    ACC = 'ACC', // accumulator
    IP = 'IP', // instruction pointer
    SP = 'SP', // stack pointer
    BR = 'BR', // buffer register
    DR = 'DR', // data register | read-write from memory
    PR = 'PR', // program register,
    ZR = 'ZR', // always zero
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

// export function data_to_instruction(data: Data): Instruction {
//     return {
//         line: 0,
//         source: 'data conversion',
//         opcode: data.value & 0x1F,
//         arg: data.value
//     };
// }
//
// export function instruction_to_data(instruction: Instruction): Data {
//     let value = instruction.opcode;
//     if(typeof instruction.arg === 'object') {
//         const addressing = (instruction.arg as Address).addressing;
//
//         value += (instruction.arg as Address).value;
//     }else
//         value += instruction.arg;
//     return {
//         value
//     };
// }