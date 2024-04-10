# Компилятор + процессор на TS

Вариант: `lisp -> asm | acc | neum | hw | tick -> instr | struct | stream | mem | pstr | prob1 | cache`

**Цель**:

+ экспериментальное знакомство с устройством процессоров через моделирование;
+ получение опыта работы с компьютерной системой на нескольких уровнях организации, разрешая противоречия между ними.

**Данная лабораторная работа носит практический характер. Она включает разработку**:

+ языка программирования и транслятора;
+ системы команд;
+ модели процессора и его принципиальной схемы;
+ нескольких алгоритмов (реализация и тестирование работы).

**Дополнительно**:

+ работа с CI;
+ средства автоматического контроля качества кода;
+ автоматическое тестирование.

Пример отчёта и реализаций транслятора и модели процессора: [Brainfuck](https://github.com/ryukzak/brainfuck).

**Примечание 1**: данная лабораторная работа не ставит перед собой задачу разработки промышленного компилятора, виртуальной машины, языка программирования или системы команд. Она подразумевает целый ряд упрощений, направленных на сокращение объёма работы. К примеру: отсутствие "внятных" сообщений об ошибках; отсутствие нормального тестирования на "некорректных" исходных и машинных кодах, отсутствие формульной проверки разработанного языка программирования, "архитектура программы по заветам ООП" и т.п.

### Разбор варианта
`lisp` -- синтаксис языка Lisp. S-exp. </br>
`acc` -- система команд должна быть выстроена вокруг аккумулятора. </br>
`neum` -- фон Неймановская архитектура. </br>
`hw` -- hardwired control unit. Реализуется как часть модели. </br>
`tick` -- процессор необходимо моделировать с точностью до такта, процесс моделирования может быть приостановлен на любом такте. </br>
`struct` -- представление машинного кода в виде высокоуровневой структуры данных. Считается, что одна инструкция укладывается в одно машинное слово. </br>
`stream` -- ввод-вывод осуществляется как поток токенов. </br>
`mem` -- memory-mapped (порты ввода-вывода отображаются в память и доступ к ним осуществляется штатными командами). </br>
`pstr` -- length-prefixed (Pascal string) реализация строк. </br>

**Усложнение:**

`cache` -- работа с памятью реализуется через кеш.
+ Скорость доступа к кешу -- 1 такт, к памяти -- 10 тактов.