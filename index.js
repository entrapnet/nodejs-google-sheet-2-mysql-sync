const fs = require('fs');
const readline = require('readline');
const {google, run_v1} = require('googleapis');

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
            resolve(true)
        } else {
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
          
          data.push({})
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

function processToMySQL(JSON) {
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
      console.log("Connected!");
      con.query(`show columns from ${config.mysql_table};`, (err, rows, fields) => {
        
        if (err) {
          reject(err)
        }
        rows.forEach((r) => {
          console.log(r.Field)
        })
        //console.log(err);
        //console.log(rows)
      })
      con.end()
      resolve(true)
    });
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
      processToMySQL(data)


    })
  })
  
}