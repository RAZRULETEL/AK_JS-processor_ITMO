import {Data, Instruction, Opcode} from "../byte-code";

export enum Register {
    ACC = 'ACC', // accumulator
    IP = 'IP', // instruction pointer
    SP = 'SP', // stack pointer
    BR = 'BR', // buffer register
    DR = 'DR', // data register | read-write from memory
    PR = 'PR', // program register,
    ZR = 'ZR', // always zero
}

export enum ProcessorState {
    Uninitialized = "Uninitialized",
    FetchingInstruction = "FetchingInstruction",
    FetchingData = "FetchingData",
    Executing = "Executing",
    WritingData = "WritingData",
    Halted = "Halted"
}

export interface Flags {
    Zero: number;
    Carry: number;
    Negative: number;
    Overflow: number;
}

export interface ProcessorRegisters{
    ACC: number;
    IP: number;
    SP: number;
    BR: number;
    DR: Instruction | Data;
    PR: Instruction | null;
    ZR: number;
}

export const JMP_CHECK_CONDITION: {[key: number]: (value: Flags) => boolean} = {
    [Opcode.EQ]: (flags) => flags.Zero === 1,
    [Opcode.NEQ]: (flags) => flags.Zero === 0,
    [Opcode.GT]: (flags) => (flags.Zero === 0) && (flags.Negative === 0),
    [Opcode.GE]: (flags) => flags.Negative === 0 || flags.Zero === 1,
    [Opcode.LT]: (flags) => flags.Negative === 1,
    [Opcode.LE]: (flags) => flags.Zero === 1 || flags.Negative === 1,
    [Opcode.JNZ]: (flags) => flags.Zero === 0,
    [Opcode.JZ]: (flags) => flags.Zero === 1
}

export const OPERANDS_REQUIRES_DATA_FETCH: Opcode[] = [
    Opcode.POP, Opcode.CMP, Opcode.LD,
    Opcode.ADD, Opcode.SUB, Opcode.MUL,
    Opcode.DIV, Opcode.MOD, Opcode.SWAP
];

export const STACK_OPERANDS: Opcode[] = [
    Opcode.POP, Opcode.CALL, Opcode.PUSH,
    Opcode.RET, Opcode.PUSH, Opcode.FLUSH
];

