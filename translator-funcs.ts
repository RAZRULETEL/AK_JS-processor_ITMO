import {Address, Addressing, Instruction, Opcode, TargetAddress} from "./byte-code";
import {FunctionContainer} from "./translator-types";
import {OUTPUT_ADDRESS} from "./translator";

export enum DefaultLibrary {
    PrintNumber = 'print@number',
    PrintString = 'print@string'
}

const FROM_RADIX = 10;
const TO_ASCII = 48;
const EMPTY_ENVIRONMENT = {
    parent: undefined,
    variables: [],
    functions: []
}

const push = create_instruction(Opcode.PUSH);
const pop = create_instruction(Opcode.POP);

export const STANDARD_FUNCTIONS: {[key: string]: FunctionContainer} = {
    [DefaultLibrary.PrintNumber]: {
        address: -1,
        name: DefaultLibrary.PrintNumber,
        body: [// Writing null-terminator
            create_instruction(Opcode.PUSH, 0, "write null-terminator"),
            create_instruction(Opcode.LD, 0),
            create_instruction(Opcode.SWAP),
            // In cycle push to stack every digit
            create_instruction(Opcode.PUSH, 0, "push digits to stack"),
            create_instruction(Opcode.MOD, FROM_RADIX),
            create_instruction(Opcode.ADD, TO_ASCII),
            create_instruction(Opcode.SWAP),
            create_instruction(Opcode.DIV, FROM_RADIX),
            create_instruction(Opcode.JNZ, {addressing: Addressing.Relative, value: -6}),
            // In cycle write every digit to output
            create_instruction(Opcode.ADD, TO_ASCII, "write digits to output"),
            create_instruction(Opcode.ST, {addressing: Addressing.Absolute, value: OUTPUT_ADDRESS}),
            pop,
            create_instruction(Opcode.CMP, 0),
            create_instruction(Opcode.JNZ, {addressing: Addressing.Relative, value: -4}),
            create_instruction(Opcode.RET, 0, `ret from ${DefaultLibrary.PrintNumber}`),
        ],
        lexical_environment: EMPTY_ENVIRONMENT
    },
    [DefaultLibrary.PrintString]: {
        address: -1,
        name: DefaultLibrary.PrintString,
        body: [// Save string address to stack
            create_instruction(Opcode.PUSH, 0, "save string address to stack"),
            create_instruction(Opcode.LD, {addressing: Addressing.Accumulator, value: 0}),// Save string length to stack
            push,// In cycle load address increment, save, get char and write it to output
            create_instruction(Opcode.LD, {addressing: Addressing.Stack, value: 1}),
            create_instruction(Opcode.INC),
            create_instruction(Opcode.ST, {addressing: Addressing.Stack, value: 1}),
            create_instruction(Opcode.LD, {addressing: Addressing.Accumulator, value: 0}),
            create_instruction(Opcode.ST, {addressing: Addressing.Absolute, value: OUTPUT_ADDRESS}),
            create_instruction(Opcode.LD, {addressing: Addressing.Stack, value: 0}),
            create_instruction(Opcode.DEC),
            create_instruction(Opcode.ST, {addressing: Addressing.Stack, value: 0}),
            create_instruction(Opcode.GE, {addressing: Addressing.Relative, value: -9}),
            pop,
            pop,
            create_instruction(Opcode.RET, 0, `ret from ${DefaultLibrary.PrintString}`),
        ],
        lexical_environment: EMPTY_ENVIRONMENT
    }
}









function create_instruction(opcode: Opcode, arg: number | TargetAddress | Address = 0, source: string = ""): Instruction{
    return {
        line: 0,
        source,
        opcode,
        arg
    }
}