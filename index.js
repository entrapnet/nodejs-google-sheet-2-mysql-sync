const fs = require('fs');
const readline = require('readline');
const {google, run_v1} = require('googleapis');
const { stringify } = require('querystring');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

let config = {
    google_sheet_id: "",
    google_range: "",
    mysql_server: "",
    mysql_user_id: "",
    mysql_password: "",
    mysql_table: "",
    mysql_database: "",
    first_row_header: true,
    mapping: {},
    header: [],
}

let lastConfig = null;

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Sheets API.
  authorize(JSON.parse(content), listMajors);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error while trying to retrieve access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

function getLastConfig() {
    return new Promise((resolve, reject) => {
        if (fs.existsSync("./config.json")) {
            lastConfig = JSON.parse( fs.readFileSync('./config.json',{encoding:'utf8', flag:'r'}))
            config = lastConfig
            config.field_type = {}
            resolve(true)
        } else {
          config.field_type = {}  
          lastConfig = config
            
          resolve(false)
        }
    })
    
}

function getGoogleSheetID() {
    return new Promise((resolve, reject) => {
        if (config.google_sheet_id != "") {
            resolve(config.google_sheet_id)
        } else {
            //'1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
              });
            
            rl.question(`Please enter google sheet id: [${lastConfig.google_sheet_id}] `, (return_gsheet_id) => {
                rl.close()
                if (return_gsheet_id == "") {
                    config.google_sheet_id = lastConfig.google_sheet_id
                } else {
                    config.google_sheet_id = return_gsheet_id
                }
                
                resolve(config.google_sheet_id)
            })
        }
    })
}

function getRange() {
    return new Promise((resolve, reject) => {
        if (config.google_range != "") {
            resolve(config.google_range)
        } else {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
              });
            
            //'1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
            rl.question(`Please enter range: [${lastConfig.google_range}]`, (return_range) => {
                rl.close()
                if (return_range == "") {
                    config.google_range = lastConfig.google_range
                } else {
                    config.google_range = return_range
                }
                
                resolve(config.google_range)
            })
        }
    })
}

function saveIntoConfig() {
    return new Promise((resolve, reject) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });
        
        rl.question("Save into config?: [Y/n]", (return_save) => {
            rl.close()
            if (return_save.toUpperCase() == "Y" || return_save == "") {
                fs.writeFile('./config.json', JSON.stringify(config), (err) => {
                    if (err) {
                        reject(err)
                    }
                    resolve(true)
                })
            } 
            
        })
    })
}

function getDataFromSpreadsheet(auth) {
  return new Promise((resolve, reject) => {
    const sheets = google.sheets({version: 'v4', auth});
    let data = []
    sheets.spreadsheets.values.get({
      spreadsheetId: config.google_sheet_id,
      range: config.google_range,
    }, (err, res) => {
      if (err) return console.log('The API returned an error: ' + err);
      const rows = res.data.values;
      if (rows.length) {
        let first_row = true
        let header = []
        rows.forEach((row) => {
          if ((first_row && config.first_row_header) == false) {
            data.push({})
          }
            let rowText = ""
            row.forEach((r, r_index) => {
              if (first_row && config.first_row_header) {
                header.push(r)
              } else {
                if (header.length > 0) {
                  data[data.length-1][header[r_index]] = r
                } else {
                  data[data.length-1][r_index] = r
                }
              }
              
            })
            if (first_row) {
              if (header.length > 0) {
                config.header = header;
              }
              first_row = false
              
            }
          //console.log(rowText);
        });
        resolve(data)
        //saveIntoConfig();
      } else {
        resolve([])
      }
    });
  })
}

function matchField(field, field_info) {
  return new Promise((resolve, reject) => {
    //console.log(field_info)
    config.field_type[field] = field_info.Type
    if (Object.keys(config.mapping).includes(field)) {
      //console.log(`--------------------`)
      console.log(`${field} ==> ${config.mapping[field]}`)
      //console.log(`--------------------`)
      
      resolve(config.mapping[field] != "~ignore~" ? field : "")
    } else {

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      console.log(`--------------------`)
      console.log(`${field}`)
      console.log(`--------------------`)
      config.header.forEach((h, h_index) => {
        console.log(`${h_index}: ${h}`)
      })
      console.log("-1: ignore")
      rl.question("Option: ", (return_option) => {
        rl.close();
        let option = "~ignore~"
        if (return_option < config.header.length && return_option != -1) {
          option = config.header[return_option]
        }
        config.mapping[field] = option
        
        resolve(option != "~ignore~" ? field : "")
      
      })
    }
  })

}

function processToMySQL(JSONdata) {
  return new Promise((resolve, reject) => {
    let mysql = require('mysql2');

    let con = mysql.createConnection({
      host: config.mysql_server,
      user: config.mysql_user_id,
      password: config.mysql_password,
      database: config.mysql_database
    });

    con.connect(function(err) {
      if (err) reject(err);
      console.log("MYSQL Connected!");
      con.query(`show columns from ${config.mysql_table};`, (err, rows, fields) => {
        

        let sqlColumn = ""

        if (err) {
          reject(err)
          return null;
        }

        let mo_promise = Promise.resolve("");
        console.log("")
        console.log("[Mapping]")
        rows.forEach((r) => {
          
          mo_promise = mo_promise.then((result) => {
            if (result != "") {
              if (sqlColumn != "") {
                sqlColumn += ","
              }
              sqlColumn +=  result 
            }
            return matchField(r.Field,r)
          })
        })

        mo_promise = mo_promise.then(() => {
          return new Promise((resolve, reject) => {
            cleanUpJSON(JSONdata).then((reviseJSON) => {
              JSONdata = reviseJSON
              resolve(true)
            })
          })
          
        })

        mo_promise.then(() => {
          let sql = `replace into ${config.mysql_table} (${sqlColumn}) values ?`;

          let values = [];

          JSONdata.forEach((j_row) => {
            let v_row = []
            sqlColumn.split(",").forEach((col_raw) => {
              let col = col_raw
              let value = j_row[config.mapping[col]]
              if (value == undefined) {
                value = null
              }
              v_row.push(value)
            })
            values.push(v_row)           
          })

          console.log(values)
          con.query(sql, [values], (err, result) => {
            if (err) {
              reject(err);
            } else {
              console.log("rows affected " + result.affectedRows);
              resolve(true)
              con.end()
            }
            
          });

          
        })
        //console.log(err);
        //console.log(rows)
      })
      
      //resolve(true)
    });
  })
}

function decimalCleanUp(value) {
  return new Promise((resolve, reject) => {
    if (value == null) {
      resolve(null)
      return null
    }
    let clean_value = value.replace(/[^\d.-]/g, '')
    if (clean_value == "") {
      clean_value = null
    }
    resolve(clean_value)
  })
}

function cleanUpJSON(JSONdata) {
  return new Promise((resolve, reject) => {
    if (Object.keys(config.mapping).length > 0) {
      JSONdata.forEach((j_item, j_index) => {
        let clean_up_array = []
        Object.keys(config.mapping).forEach((col) => {
          if (config.mapping[col] != "~ignore~") {
            if ( config.field_type[col].substring(0,7) == "decimal") {
              clean_up_array.push(decimalCleanUp(j_item[col]).then((clean_value) => { 
                JSONdata[j_index][col] = clean_value
                return Promise.resolve(true) 
              }))
            }
          }
          
          //j_item[col]
        })
        Promise.all(clean_up_array).then(() => {
          resolve(JSONdata)
        })
      })
    } else {
      resolve(JSONdata)
    }
  })
}

/**
 * Prints the names and majors of students in a sample spreadsheet:
 * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
function listMajors(auth) {
  
  
  let preWorkArray = Promise.resolve()

  preWorkArray = preWorkArray.then(() => {
      return getLastConfig()
  })

  preWorkArray = preWorkArray.then(() => {
      return getGoogleSheetID()
  })

  preWorkArray = preWorkArray.then(() => {
    return getRange()
  })

//   PA = PA.then(() => {
//       return saveIntoConfig()
//   })

  preWorkArray.then(() => {
    getDataFromSpreadsheet(auth).then((data) => {
      console.log(data)
      //saveIntoConfig()
      processToMySQL(data).then(() => {
        saveIntoConfig();
      })
      

    })
  })
  
}