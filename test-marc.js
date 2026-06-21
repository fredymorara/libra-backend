const { Marc, Record } = require('marcjs');
let record = new Record();
record.append(['020', '  ', 'a', '9780131103627', 'q', 'paperback']);
record.append(['245', ' 1', 'a', 'Middlemarch /', 'c', 'Georges Eliot.']);
console.log(JSON.stringify(record.fields, null, 2));
