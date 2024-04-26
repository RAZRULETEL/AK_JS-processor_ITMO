import * as fs from "fs";
import {SourceProgram} from "./translator-types";
import {execSync} from "child_process";


interface GoldenTestConfig {
    input_lisp: string[];
    output_json: SourceProgram;
    input_stdin: string;
    output_stdout: string;
}

const TEST_TEMP_DIR = 'tmp';
const TEST_OUTPUT_SOURCE = `${TEST_TEMP_DIR}/output.json`;
const TEST_INPUT_STDIN = `${TEST_TEMP_DIR}/input`;
const TEST_PROCESSOR_TIME_LIMIT = 1_000_000;

const TRANSLATOR_PATH = "./translator.js";
const PROCESSOR_PATH = "./model/processor.js";

describe('Running golden tests', () => {
    it.each([
        "tests/factorial.json",
        "tests/prob1.json",
        "tests/hello.json",
    ])(`from file %p`, (test_config: string) => {
        const config = JSON.parse(fs.readFileSync(test_config, "utf8")) as GoldenTestConfig;

        if (!fs.existsSync(TEST_TEMP_DIR))
            fs.mkdirSync(TEST_TEMP_DIR);

        fs.writeFileSync(`${TEST_TEMP_DIR}/input.lisp`, config.input_lisp.join(""));
        fs.writeFileSync(TEST_INPUT_STDIN, config.input_stdin);

        execSync(`node ${TRANSLATOR_PATH} ${TEST_TEMP_DIR}/input.lisp ${TEST_OUTPUT_SOURCE}`);
        expect(JSON.parse(fs.readFileSync(TEST_OUTPUT_SOURCE, 'utf8'))).toEqual(config.output_json);

        const stdout = execSync(`node ${PROCESSOR_PATH} ${TEST_OUTPUT_SOURCE} ${TEST_INPUT_STDIN} ${TEST_PROCESSOR_TIME_LIMIT}`);
        expect(stdout.toString()).toEqual(config.output_stdout);

        fs.rmSync(TEST_TEMP_DIR, { force: true, recursive: true });
    })
});