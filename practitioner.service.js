/*eslint no-unused-vars: "warn"*/

//And only search by id, by specific criteria and create
//Housekeeping for sequelize
const { DataTypes } = require("sequelize");
const sequelize = require('./dbconfig').db;

//Specific models for our legacy person object
const Person = require('./models/PERSON');
const PersonDoc = require('./models/PERSON_DOC');
const DocType = require('./models/DOC_TYPE');

//Mapping between FHIR system and legacy document type
const LegacyDocumentType = require('./legacy_document_type');

//UID generator for bundles
const uuidv4 = require('uuid').v4;

//FHIR specific stuff: Server, resources: Patient, Bundle, OperationOutcome and Entry
const { RESOURCES } = require('@asymmetrik/node-fhir-server-core').constants;
const FHIRServer = require('@asymmetrik/node-fhir-server-core');
const getPractitioner = require('@asymmetrik/node-fhir-server-core/src/server/resources/4_0_0/schemas/practitioner');
const getBundle = require('@asymmetrik/node-fhir-server-core/src/server/resources/4_0_0/schemas/bundle');
const getOperationOutcome = require('@asymmetrik/node-fhir-server-core/src/server/resources/4_0_0/schemas/operationoutcome');
const getBundleEntry = require('@asymmetrik/node-fhir-server-core/src/server/resources/4_0_0/schemas/bundleentry');

//Meta data for FHIR R4
let getMeta = (base_version) => {
    return require(FHIRServer.resolveFromVersion(base_version, RESOURCES.META));
};

//How to search the address of our server, so we can return it in the fullURL for each Patient entry
function GetBaseUrl(context) {
    var baseUrl = "";
    const FHIRVersion = "/4_0_0/";
    var protocol = "http://";
    if (context.req.secure) { protocol = "https://"; }
    baseUrl = protocol + context.req.headers.host + FHIRVersion;
    return baseUrl;

};

module.exports.search = (args, context, logger) => new Promise((resolve, reject) => {
    // Common search params, we only support _id
    let { base_version, _content, _format, _id, _lastUpdated, _profile, _query, _security, _tag } = args;

    // Search Result params ,we only support _count
    let { _INCLUDE, _REVINCLUDE, _SORT, _COUNT, _SUMMARY, _ELEMENTS, _CONTAINED, _CONTAINEDTYPED } = args;
    
    let baseUrl = GetBaseUrl(context);
    // These are the parameters we can search for : name, identifier, family, gender and birthDate
    let name = args['name'];
    let iden = args['identifier'];
    let coun = context.req.query['_count'];
    let page = context.req.query ['_page'];
    // Special search parameter to search by Id instead of direct read
    let idx = args[_id];
    
    let person = new Person(sequelize, DataTypes);
    let personDoc = new PersonDoc(sequelize, DataTypes);
    let docType = new DocType(sequelize, DataTypes);

    personDoc.belongsTo(docType, { 
        as: 'DOC_TYPE',
        foreignKey: 'PRDT_DCTP_ID'
    })
    
    
    person.hasMany(personDoc, {
        as: 'PERSON_DOC',
        foreignKey: 'PRDT_PRSN_ID'
    })
    
    const { Op } = require("sequelize");

    let criteria = []; 

    if (name) { 
        criteria.push({
            [Op.or]: [{
                PRSN_LAST_NAME: { 
                    [Op.like]: '%' + name + '%'
                }
            },
            {
                PRSN_FIRST_NAME: {
                    [Op.like]: '%' + name + '%'
                }
            },
            {
                PRSN_SECOND_NAME: {
                    [Op.like]: '%' + name + '%'
                }
            }
        ]
        });
    }

 

    include = [{
        model: personDoc,
        as: 'PERSON_DOC',
        where: { PRDT_DCTP_ID: 3 },
        include: [{
            model: docType,
            as: 'DOC_TYPE'
        }]
    }];

    // check for NPI identifier
    //include.where = [{ PRDT_DCTP_ID: 3 }];
    //criteria.push({ personDoc: 3 })

    if (iden) { 
        var search_type = "";
        var search_value = "";
        var v = iden.split("|");

        if (v.length > 1) { 
            var search_system = v[0];
            let legacyMapper = LegacyDocumentType;
            search_type = legacyMapper.GetDocumentType(search_system);
            search_value = v[1];
        } else { 
            search_value = iden;
        }

        GetPersonsByIdentifier(personDoc, docType, search_type, search_value)
            .then(
                result => {
                    result.forEach(item => { criteria.push(item) });
                    GetPractitioners(person, include, criteria, context, coun, page)
                    .then(result => { resolve(result); })
                }
            )
    } else {
        //Normal search using all the criteria but 'identifier'
        GetPractitioners(person, include, criteria, context, coun, page)
            .then(result => { resolve(result); })

    }

})

//This function/promise returns an array of sequelize criteria with 
//the legacy person id with a specific document type/number

function GetPersonsByIdentifier(personDoc, docType, searchType, searchValue) {
    return new Promise(

        function(resolve, reject)

        {
            //Empty array of person id's
            persons = [];
            //Special type of identifier: "ID" because it's not really an identifier
            //It's the server assigned ID
            if (searchType == "ID") {
                persons.push({ PRSN_ID: searchValue })
                resolve(persons);
            } else {
                // Association between DOC_TYPE and PERSON_DOC to search by the abbreviated type and not by ID
                let include = [{
                    model: docType,
                    as: 'DOC_TYPE'

                }];
                // Criteria involves the document number
                let criteria = [];
                if (searchType != "") {
                    include.where = [{ DCTP_ABREV: searchType }];
                }

                // check for NPI document
                criteria.push({ PRDT_DCTP_ID: 3 })
                criteria.push({ PRDT_DOC_VALUE: searchValue })
                    // Here we ask for all the persons matching the criteria
                personDoc.findAll({
                    where: criteria,
                    include: include
                }).then(
                    personDocs => {
                        personDocs.forEach(
                            personDoc => {
                                //And add them to the criteria array
                                persons.push({ PRSN_ID: personDoc.PRDT_PRSN_ID })
                            }
                        );
                        if (persons.length == 0) {
                            //tricky: there was no person we add something that will always fail
                            //in a autonumeric INT, to ensure that we will return no 
                            //patient at all
                            persons.push({ PRSN_ID: -1 });
                        }
                        //And that's our completed job
                        resolve(persons);
                    }

                );
            }
        })
}

//This is the specific search for all patients matching the query
function GetPractitioners(person, include, criteria, context, coun, page) {
    return new Promise(
        function(resolve, reject)
        {
            //Here we solve paginations issues: how many records per page, which page
            let offset = 0
            let limit = 0
            if (!coun) { coun = 5; }
            if (coun == "") { coun = 5; }
            let pageSize = parseInt(coun);

            if (!page) { page = 1; }
            if (page == "") { page = 1; }
            pageInt = parseInt(page);
            offset = (pageInt - 1) * pageSize;
            limit = pageSize;
            //Bundle and Entry definitions
            let BundleEntry = getBundleEntry;
            let Bundle = getBundle;
            //Our Base address
            let baseUrl = GetBaseUrl(context);

            result = [];
            entries = [];
            //Get total number of rows
            //because we want to know how many records in total we have
            //to report that in our searchset bundle

            person.findAndCountAll({
                where: criteria,
                include: include,
                distinct: true

            }).then(TotalCount => {
                console.log('\n\nFound ' + TotalCount.count + ' records.\n\n')
                //Adjust page offset and limit to the total count
                if (offset + limit > TotalCount.count) {
                    limit = TotalCount.count;
                    offset = 0;
                }
                //Now we actually do the search combining the criteria, inclusions, limit and offset
                person.findAll({
                        where: criteria,
                        include: include,
                        limit: limit,
                        offset: offset,
                        subQuery: false
                    })
                    .then(
                        MyPersons => {
                            MyPersons.forEach(
                                MyPerson => {
                                    console.log(MyPerson)
                                    //We map from legacy person to patient
                                    MyPractitioner = PersonToPractitionerMapper(MyPerson);
                                    //Add the identifiers
                                    MyPractitioner = PersonIdentifierToPractitionerIdentifierMapper(MyPractitioner, MyPerson);
                                    //And save the result in an array
                                    result.push(MyPractitioner);
                                });
                            //With all the patients we have in the result.array
                            //we assemble the entries
                            let entries = result.map(practitioner =>
                                new BundleEntry({
                                    fullUrl: baseUrl + '/Practitioner/' + practitioner.id,
                                    resource: practitioner
                                }));
                            //We assemble the bundle
                            //With the type, total, entries, id, and meta
                            let bundle = new Bundle({
                                id: uuidv4(),
                                meta: {
                                    lastUpdated: new Date()
                                },
                                type: "searchset",
                                total: TotalCount.count,
                                entry: entries

                            });
                            //And finally, we generate the link element
                            //self (always), prev (if there is a previous page available)
                            //next (if there is a next page available)
                            var OriginalQuery = baseUrl + "Practitioner";
                            var LinkQuery = baseUrl + "Practitioner";
                            var parNum = 0;
                            var linkParNum = 0;
                            //This is to reassemble the query
                            for (var param in context.req.query) {
                                if (param != "base_version") {
                                    var sep = "&";
                                    parNum = parNum + 1;

                                    if (parNum == 1) { sep = "?"; }
                                    OriginalQuery = OriginalQuery + sep + param + "=" + context.req.query[param];


                                    if ((param != "_page") && (param != "_count")) {

                                        var LinkSep = "&";
                                        linkParNum = linkParNum + 1;
                                        if (linkParNum == 1) { LinkSep = "?"; }
                                        LinkQuery = LinkQuery + LinkSep + param + "=" + context.req.query[param];
                                    }

                                }
                            };
                            //self is always there
                            MyLinks = [{
                                relation: "self",
                                url: OriginalQuery
                            }];
                            //prev and next may or not exist
                            if (pageInt > 1) {
                                const prevPage = pageInt - 1;
                                MyLinks.push({
                                    relation: "prev",
                                    url: LinkQuery + "&_count=" + coun + "&_page=" + prevPage.toString()
                                });
                            }
                            MaxPages = (TotalCount.count / coun) + 1;
                            MaxPages = parseInt(MaxPages);
                            if (pageInt < MaxPages) {

                                const nextPage = pageInt + 1;
                                MyLinks.push({
                                    relation: "next",
                                    url: LinkQuery + "&_count=" + coun + "&_page=" + nextPage.toString()
                                });
                            }
                            bundle.link = MyLinks;
                            //Now we have all the required elements 
                            //So we can return the complete bundle
                            resolve(bundle);


                        });

            });


        });
}
// Person to Practitioner mapper
// This funcion receives a legacy person and returns a FHIR Patient
// 
function PersonToPractitionerMapper(MyPerson) {

    let R = new getPractitioner();
    if (MyPerson) {
        //Logical server id
        R.id = MyPerson.PRSN_ID.toString();
        //We only have family, given and text
        //If we have more than one given, we will adjust later
        R.name = [{
            use: "official",
            family: MyPerson.PRSN_LAST_NAME,
            given: [MyPerson.PRSN_FIRST_NAME],

            text: MyPerson.PRSN_FIRST_NAME + " " + MyPerson.PRSN_LAST_NAME

        }];

        //We map our legacy identifier type to FHIR system
        let legacyMapper = LegacyDocumentType;
        mapper = legacyMapper.GetDocumentSystemUse("ID");
        //We have the identifier (use, system, value)
        R.identifier = [{
            use: mapper.use,
            system: mapper.system,
            value: MyPerson.PRSN_ID.toString(),
            period: { start: MyPerson.createdAt }
        }];

        // var perDocList = MyPerson.PERSON_DOC;
        // var idx = -1;
        // for (let i = 0; i < perDocList.length; i++) { 
        //     // checking if the person has an NPI reference
        //     if (perDocList[i].PRDT_DCTP_ID == 3) {
        //         idx = i;
        //         break;
        //     }
        // }
        // if (idx != -1) {
        //     mapper = legacyMapper.GetNPI()
        //     R.identifier.push({
        //         use: mapper.use,
        //         system: mapper.sytem,
        //         value = perDocList[idx].PRDT_DOC_VALUE,
        //         period: { start: MyPerson.createdAt }
        //     })
        // }
  
        //Full text for the resource
        //NO automatic narrative

        R.text = {
            "status": "generated",
            "div": '<div xmlns="http://www.w3.org/1999/xhtml">' + R.name[0].text + "</div>"
        };
    }
    //And that's our resource
    return R;
}
//Providing special support for the person's identifiers 
function PersonIdentifierToPractitionerIdentifierMapper(R, MyPerson) {
    //Our helper for transforming the legacy to system/value
    let legacyMapper = LegacyDocumentType;
    MyDocs = MyPerson.PERSON_DOC;

    if (MyDocs) {
        // For each legacy identifier
        MyDocs.forEach(doc => {
            var docTypeCode = doc.DOC_TYPE.DCTP_ABREV;
            var docNumber = doc.PRDT_DOC_VALUE;
            var startDate = doc.createdAt
            var mapped = legacyMapper.GetDocumentSystemUse(docTypeCode);
            if (mapped.system != "") {
                //Assemble each identifier
                //use-system-value-period
                var oldCol = R.identifier;
                oldCol.push({
                    use: mapped.use,
                    system: mapped.system,
                    value: docNumber,
                    period: { start: startDate }
                })
                R.identifier = oldCol;

            }
        });
        return R;
    }
}

//POST of a new Patient Instance
module.exports.create = (args, context, logger) => new Promise((resolve, reject) => {
    //	logger.info('Patient >>> searchById');
    let { base_version } = args;
    //Our legacy model
    let docType = new DocType(sequelize, DataTypes);
    let person = new Person(sequelize, DataTypes);
    let personDoc = new PersonDoc(sequelize, DataTypes);
    //The incoming resource is in the request body
    //Note: Only JSON is supported
    resource = context.req.body;
    //Mapping of each resource element
    //To our legacy structure
    //First we need to extract the information
    lastName = resource.name[0].family;
    firstName = resource.name[0].given[0];
    secondName = resource.name[0].given[1];
    birthDate = resource.birthDate;
    gender = resource.gender;
    email = resource.telecom[0].value;
    nickname = resource.name[1].given[0];
    //We assemble the object for sequelizer to take
    //charge of the instance creation
    person.create({
        PRSN_FIRST_NAME: firstName,
        PRSN_SECOND_NAME: secondName,
        PRSN_LAST_NAME: lastName,
        PRSN_BIRTH_DATE: birthDate,
        PRSN_GENDER: gender,
        PRSN_EMAIL: email,
        PRSN_NICK_NAME: nickname,
        createdAt: new Date().toISOString(),
        updatedAt: ""
    }).then(
        person => {
            //This is the new resource id (server assigned)
            newId = person.PRSN_ID;
            //For each identifier, we create a new PERSON_DOC record
            //But we need to search for the ID of the document type first

            resource.identifier.forEach(
                ident => {
                    let legacyMapper = LegacyDocumentType;
                    search_type = legacyMapper.GetDocumentType(ident.system);
                    //FHIR identifier.system -> document type
                    if (search_type != "") {
                        //document type code -> document type id
                        docType.findOne({
                                where: { DCTP_ABREV: search_type },
                            })
                            .then(
                                doc => {
                                    docTypeid =
                                        personDoc.create({
                                            //With the document type and value
                                            //And the person id we 
                                            //create the new record in PERSON_DOC
                                            PRDT_PRSN_ID: newId,
                                            PRDT_DCTP_ID: doc.DCTP_ID,
                                            PRDT_DOC_VALUE: ident.value,
                                            createdAt: new Date().toISOString(),
                                            updatedAt: ''
                                        });
                                });


                    }

                });
            //This is all the information that the response will have about the patient
            //the newId in Location
            resolve({ id: newId });

        });
});

module.exports.searchById = (args, context, logger) => new Promise((resolve, reject) => {
    //logger.info('Patient >>> searchById');
    let { base_version, id } = args; 
    let person = new Person(sequelize, DataTypes);
    let personDoc = new PersonDoc(sequelize, DataTypes);
    let docType = new DocType(sequelize, DataTypes);
    personDoc.belongsTo(docType, {
        as: 'DOC_TYPE',
        foreignKey: 'PRDT_DCTP_ID'

    });
    person.hasMany(personDoc, { as: 'PERSON_DOC', foreignKey: 'PRDT_PRSN_ID' });


    person
        .findOne({
            where: { PRSN_ID: id },
            include: [{
                model: personDoc,
                as: 'PERSON_DOC',
                where: { PRDT_DCTP_ID: 3 },
                include: [{
                    model: docType,
                    as: 'DOC_TYPE'
                }]
            }]
        })
        .then(
            MyPerson => {
                if (MyPerson) {

                    R = PersonToPractitionerMapper(MyPerson);
                    R = PersonIdentifierToPractitionerIdentifierMapper(R, MyPerson);
                    resolve(R);
                } else {
                    let OO = new getOperationOutcome();
                    let legacyMapper = LegacyDocumentType;
                    var mapped = legacyMapper.GetDocumentSystemUse("ID");
                    var message = "Patient with identifier " + mapped.system + " " + id + " not found ";
                    OO.issue = [{
                        "severity": "error",
                        "code": "processing",
                        "diagnostics": message
                    }]
                    resolve(OO);
                }
            })
        .catch(error => {
            console.log(error);
            let OO = new getOperationOutcome();
            var message = error;
            OO.issue = [{
                "severity": "error",
                "code": "processing",
                "diagnostics": message
            }]
            resolve(OO);


        })
})