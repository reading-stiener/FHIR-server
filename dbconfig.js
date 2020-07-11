var Sequelize = require('sequelize');
var sequelize = new Sequelize('database', 'username', 'password', {
    dialect: 'sqlite',
    storage: './persondb.db',
    dialectOptions: {
        // Your sqlite3 options here
    }
});

module.exports.db = sequelize