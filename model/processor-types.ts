import {Data, Instruction, Opcode} from "../byte-code";

export enum ProcessorState {
    Uninitialized,
    FetchingInstruction,
    FetchingData,
    Executing,
    WritingData,
    Halted
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
    [Opcode.GT]: (flags) => flags.Carry === 1,
    [Opcode.GE]: (flags) => flags.Carry === 1 || flags.Zero === 1,
    [Opcode.LT]: (flags) => flags.Carry === 0 && flags.Zero === 0,
    [Opcode.LE]: (flags) => flags.Carry === 0,
    [Opcode.JNZ]: (flags) => flags.Zero === 0,
    [Opcode.JZ]: (flags) => flags.Zero === 1
}

export const OPERANDS_REQUIRES_DATA_FETCH: Opcode[] = [
    Opcode.POP, Opcode.CMP, Opcode.LD,
    Opcode.ADD, Opcode.SUB, Opcode.MUL,
    Opcode.DIV, Opcode.MOD
];

export const STACK_OPERANDS: Opcode[] = [
    Opcode.POP, Opcode.CALL, Opcode.PUSH,
    Opcode.RET, Opcode.PUSH, Opcode.FLUSH
];

