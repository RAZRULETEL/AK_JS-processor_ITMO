import {Address, Addressing, INPUT_ADDRESS, Instruction, OUTPUT_ADDRESS, Opcode} from "./byte-code";
import {FunctionContainer, TargetAddress} from "./translator-types";

export enum DefaultLibrary {
    PrintNumber = 'print@number',
    PrintString = 'print@string',
    ReadString = 'read@string',
}

const FROM_RADIX = 10;
const TO_ASCII = 48;
const NEWLINE_CODE = 10;
const EMPTY_ENVIRONMENT = {
    parent: undefined,
    variables: [],
    functions: []
}

const push = create_instruction(Opcode.PUSH);
const pop = create_instruction(Opcode.POP);
const swap = create_instruction(Opcode.SWAP);
const print = create_instruction(Opcode.ST, {addressing: Addressing.Absolute, value: OUTPUT_ADDRESS});
const read = create_instruction(Opcode.LD, {addressing: Addressing.Absolute, value: INPUT_ADDRESS});

export const STANDARD_FUNCTIONS: {[key: string]: FunctionContainer} = {
    [DefaultLibrary.PrintNumber]: {
        address: -1,
        name: DefaultLibrary.PrintNumber,
        body: [// Writing null-terminator
            create_instruction(Opcode.PUSH, 0, "write null-terminator"),
            create_instruction(Opcode.LD, 0),
            swap,
            // In cycle push to stack every digit
            create_instruction(Opcode.PUSH, 0, "push digits to stack"),
            create_instruction(Opcode.MOD, FROM_RADIX),
            create_instruction(Opcode.ADD, TO_ASCII),
            swap,
            create_instruction(Opcode.DIV, FROM_RADIX),
            create_instruction(Opcode.JNZ, {addressing: Addressing.Relative, value: -6}),
            // In cycle write every digit to output
            create_instruction(Opcode.ADD, TO_ASCII, "write digits to output"),
            print,
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
            print,
            create_instruction(Opcode.LD, {addressing: Addressing.Stack, value: 0}),
            create_instruction(Opcode.DEC),
            create_instruction(Opcode.ST, {addressing: Addressing.Stack, value: 0}),
            create_instruction(Opcode.GE, {addressing: Addressing.Relative, value: -9}),
            pop,
            pop,
            create_instruction(Opcode.RET, 0, `ret from ${DefaultLibrary.PrintString}`),
        ],
        lexical_environment: EMPTY_ENVIRONMENT
    },
    [DefaultLibrary.ReadString]: {
        address: -1,
        name: DefaultLibrary.ReadString,
        body: [// Save string address to stack
            push,
            create_instruction(Opcode.LD, 0),
            swap,
            push,
            pop,
            create_instruction(Opcode.INC),
            push,
            read,
            create_instruction(Opcode.CMP, NEWLINE_CODE),
            create_instruction(Opcode.LE, {addressing: Addressing.Relative, value: 5}),
            create_instruction(Opcode.ST, {addressing: Addressing.IndirectStack, value: 0}),
            // Load counter, increment and save
            create_instruction(Opcode.LD, {addressing: Addressing.Stack, value: 1}),
            create_instruction(Opcode.INC),
            create_instruction(Opcode.ST, {addressing: Addressing.Stack, value: 1}),
            create_instruction(Opcode.JMP, {addressing: Addressing.Relative, value: -11}),
            // Save string length and return
            pop,
            create_instruction(Opcode.SUB, {addressing: Addressing.Stack, value: 0}),
            swap,
            create_instruction(Opcode.ST, {addressing: Addressing.IndirectStack, value: -1}),
            create_instruction(Opcode.FLUSH),
            create_instruction(Opcode.RET, 0, `ret from ${DefaultLibrary.ReadString}`)
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