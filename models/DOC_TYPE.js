/* jshint indent: 1 */
//This structures were automatically generated from 
//our legacy tables by sequelize-auto
//These are the document (identifier) types

module.exports = function(sequelize, DataTypes) {
    const DOC_TYPE = sequelize.define('DOC_TYPE', {
        DCTP_ID: {
            type: DataTypes.INTEGER,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        DCTP_ABREV: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        DCTP_DESC: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        DCTP_CREATE_DATE: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        tableName: 'DOC_TYPE',
        freezeTableName: true,
        timestamps: false
    });
    return DOC_TYPE;
};