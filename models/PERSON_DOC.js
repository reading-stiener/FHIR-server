/* jshint indent: 1 */
//This structures were automatically generated from 
//our legacy tables by sequelize-auto
//This is the relationship from a person to its documents (identifiers)
module.exports = function(sequelize, DataTypes) {
    const PERSON_DOC = sequelize.define('PERSON_DOC', {
        PRDT_ID: {
            type: DataTypes.INTEGER,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        PRDT_PRSN_ID: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'PERSON',
                key: 'PSN_ID'
            }
        },
        PRDT_DCTP_ID: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'DOC_TYPE',
                key: 'DCTP_ID'
            }
        },
        PRDT_DOC_VALUE: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        createdAt: {
            field: "PRDT_CREATE_DATE",
            type: DataTypes.TEXT,
            allowNull: true
        },
        updatedAt: {
            field: "PRDT_DELETE_DATE",
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        tableName: 'PERSON_DOC',
        freezeTableName: true,
        timestamps: false
    });
    return PERSON_DOC;
};