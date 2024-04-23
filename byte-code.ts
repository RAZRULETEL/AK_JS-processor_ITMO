/* eslint-disable no-magic-numbers */

export enum Addressing {// Zero reserved for direct load
    Relative = 1,
    Absolute = 2,
    Stack = 3,
    Accumulator = 4,
}


export interface Address{
    addressing: Addressing;
    value: number;
}

export interface TargetAddress{
    type: 'variable' | 'function' | 'stack' | 'string';
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
    FLUSH = 25, // increment SP,
    SWAP = 26, // ACC <=> mem[SP]
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
// Instruction format:
// xxxx xxaa a000 ...
// x - opcode, a - addressing, 0 - value
const OPCODE_MASK = 0x1F;
const ADDRESSING_MASK = 0xE0;

export function data_to_instruction(data: Data): Instruction {
    let arg: number | Address = data.value >> 8
    if((data.value & ADDRESSING_MASK) !== 0)
        arg = { addressing: data.value & ADDRESSING_MASK >> 5, value: arg };

    return {
        line: 0,
        source: 'data conversion',
        opcode: data.value & OPCODE_MASK,
        arg
    };
}

export function instruction_to_data(instruction: Instruction): Data {
    let value = instruction.opcode;
    if(typeof instruction.arg === 'object'){
        if("addressing" in instruction.arg){
            value += instruction.arg.addressing << 5;
        }
    }else
        value += instruction.arg << 8;

    return {value};
}