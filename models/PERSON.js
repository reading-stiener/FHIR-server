/* jshint indent: 1 */
//This structures were automatically generated from 
//our legacy tables by sequelize-auto
//This is demographic information about the patient: names, gender, birth date, nickname and one email
const PERSON_DOC = require('./PERSON_DOC');
module.exports = function(sequelize, DataTypes) {

    const PERSON = sequelize.define('PERSON', {
        PRSN_ID: {
            type: DataTypes.INTEGER,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        PRSN_FIRST_NAME: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        PRSN_SECOND_NAME: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        PRSN_LAST_NAME: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        PRSN_BIRTH_DATE: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        PRSN_GENDER: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        PRSN_EMAIL: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        PRSN_NICK_NAME: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        createdAt: {
            field: "PRSN_CREATE_DATE",
            type: DataTypes.TEXT,
            allowNull: true
        },
        updatedAt: {
            field: "PRSN_UPDATE_DATE",
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        tableName: 'PERSON',
        freezeTableName: true,
        timestamps: false

    });


    return PERSON;
};