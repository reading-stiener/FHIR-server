//Which system identifier for each document type
//We cannot modify the database so this should be done
//at the mapper level
//based on a configuration file
//We read this mapping from a json file
const options = require('./fhir_options.json');
//Two functions 
//One of them returns the legacy type given the FHIR system for the identifier
function GetDocumentType(system) {
    var type = "";
    const DocTypeToSystemMap = options.SystemMap;
    var MyIndex = -1;
    for (let i = 0; i < DocTypeToSystemMap.length; i++) {
        if (DocTypeToSystemMap[i].system == system) {
            MyIndex = i;
            break;
        }
    };
    if (MyIndex > -1) {
        type = DocTypeToSystemMap[MyIndex].type;
    }
    return type;
}
//The other returns use and system for each legacy document type
function GetDocumentSystemUse(abbrev) {

    var system = "";
    var use = "";
    const DocTypeToSystemMap = options.SystemMap;
    var MyIndex = -1;
    for (let i = 0; i < DocTypeToSystemMap.length; i++) {
        if (DocTypeToSystemMap[i].type == abbrev) {
            MyIndex = i;
            break;
        }
    };
    if (MyIndex > -1) {
        system = DocTypeToSystemMap[MyIndex].system;
        use = DocTypeToSystemMap[MyIndex].use;
    }
    return { system, use };

}

function GetNPI(){
    var system = '';
    var use ='';
    const DocTypeToSystemMap = options.SystemMap;
    var MyIndex = -1;
    for (let i = 0; i < DocTypeToSystemMap.length; i++) { 
        if (DocTypeToSystemMap[i].type == 'NPI') {
            MyIndex = i;
            break;
        }
    };
    if (MyIndex > -1) { 
        system = DocTypeToSystemMap[MyIndex].system;
        use = DocTypeToSystemMap[MyIndex].use;
    }
    return { system, use }
}

module.exports = { GetDocumentSystemUse, GetDocumentType, GetNPI }