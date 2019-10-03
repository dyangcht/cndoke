// express as API services + serving H5 client
var express = require('express');
var app = express();

var path = require('path');

// using 80 for nodejs, we can forward in k8
var PORT = process.env.PORT || 80;

// database required initialization
//   DB config will be replaced by ATP credentials
//   getting from environment variables
// var dbConfig = require('./dbconfig.js');
var oracledb = require('oracledb');
// enable aauto commit
oracledb.autoCommit = true;
// edit by kenneth - since there is no environment variable, we will use config file
// comment the next 2 lines
// var dbpass = process.env.DB_ADMIN_PWD;
// dbpass = dbpass.replace("\n","");
// reading database connection prop from config file
//   should re-visit, and use only environment variables
// since there is no environments, we simply change the connection properties to dbConfig values
var connectionProperties = {
  user: process.env.DB_ADMIN_USER,
  password: process.env.DBPASSWORD,
  connectString: process.env.DB_DESCRIPTOR
};
// var connectionProperties = {
//  user: dbConfig.dbuser,
//  password: dbConfig.dbpassword,
//  connectString: dbConfig.connectString
// };

// additional requires
var bodyParser = require('body-parser');
// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ type: '*/*' }));

// common function to close / release db connection
function doRelease(connection) {
  console.log('release db connection in doRelease function');
  connection.release(function (err) {
    if (err) {
      console.error(err.message);
    }
  });
}

// serving APIs with Router
var router = express.Router();

// setup CORS profile
//   can be remove if we are serving H5 with the
//   same service
router.use(function (request, response, next) {
  console.log("REQUEST:" + request.method + "   " + request.url);
  console.log("BODY:" + JSON.stringify(request.body));
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  response.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  response.setHeader('Access-Control-Allow-Credentials', true);
  next();
});

/**
 * GET /loyalty/v1/points/:userid
 * Returns the point balance
 */
router.route('/v1/points/:userid').get(function (request, response) {
  console.log("GET POINT BALANCE BY ID:" + request.params.userid);
  oracledb.getConnection(connectionProperties, function (err, connection) {
      if (err) {
          console.error(err.message);
          response.status(500).send("Error connecting to DB");
          return;
      }
      var id = request.params.userid;
      connection.execute("SELECT POINTS FROM CUSTOMER WHERE ID = :id",[id],
        { outFormat: oracledb.OBJECT },
        function (err, result) {
          if (err) {
              console.error(err.message);
              response.status(500).send("Error getting data from DB");
              doRelease(connection);
              return;
          }
          console.log("RESULTSET:" + JSON.stringify(result));
          if (result.rows.length === 1) {
              var responseBody = { points: result.rows[0].POINTS };
              response.json(responseBody);
              doRelease(connection);
          } else {
              response.end();
              doRelease(connection);
          }
      });
  });
});

/**
 * POST /loyalty/v1/points/:userid
 * Credits 1 point and returns the point balance
 */
router.route('/v1/points/:userid').post(function (request, response) {
  console.log("POST CREDIT 1 POINT and POINT BALANCE BY ID:" + request.params.userid);
  oracledb.getConnection(connectionProperties, function (err, connection) {
      if (err) {
          console.error(err.message);
          response.status(500).send("Error connecting to DB");
          return;
      }
      var id = request.params.userid;
      connection.execute("SELECT POINTS FROM CUSTOMER WHERE ID = :id",[id],
        { outFormat: oracledb.OBJECT },
        function (err, result) {
          if (err) {
              console.error(err.message);
              response.status(500).send("Error getting data from DB");
              doRelease(connection);
              return;
          }
          console.log("RESULTSET:" + JSON.stringify(result));
          if (result.rows.length === 1) {
              var user_points = result.rows[0].POINTS;
              var responseBody;
              if (user_points === 2) {
		              console.log('points will be 3 after update, need to update coupons');
                  connection.execute("UPDATE CUSTOMER SET POINTS = 0, COUPONS=COUPONS+1 WHERE ID = :id",[id],
                    { outFormat: oracledb.OBJECT },
                    function (err, result) {
                      if (err) {
                          console.error(err.message);
                          response.status(500).send("Error saving to DB");
                          doRelease(connection);
                          return;
                      } else {
                          responseBody = { points: 0 };
                          response.json(responseBody);
                          doRelease(connection);
		                  }
                  });
              } else {
                  console.log('points is not 3 after update, update now points only');
                  connection.execute("UPDATE CUSTOMER SET POINTS = POINTS+1 WHERE ID = :id",[id],
                    { outFormat: oracledb.OBJECT },
                    function (err, result) {
                      if (err) {
                          console.error(err.message);
                          response.status(500).send("Error saving to DB");
                          doRelease(connection);
                          return;
                      } else {
                          responseBody = { points: user_points+1 };
                          response.json(responseBody);
                          doRelease(connection);
		                  }
                  });
              }
          } else {
	      console.log('row length is NOT 1 end response and call doRelease');
              response.end();
              doRelease(connection);
          }
      });
  });
});

/**
 * GET /loyalty/v1/coupon/:userid
 * Returns the coupon balance
 */
router.route('/v1/coupon/:userid').get(function (request, response) {
  console.log("GET COUPON BALANCE BY ID:" + request.params.userid);
  oracledb.getConnection(connectionProperties, function (err, connection) {
      if (err) {
          console.error(err.message);
          response.status(500).send("Error connecting to DB");
          return;
      }
      console.log("After connection");
      var id = request.params.userid;
      connection.execute("SELECT COUPONS FROM CUSTOMER WHERE ID = :id",[id],
        { outFormat: oracledb.OBJECT },
        function (err, result) {
          if (err) {
              console.error(err.message);
              response.status(500).send("Error getting data from DB");
              doRelease(connection);
              return;
          }
          console.log("RESULTSET:" + JSON.stringify(result));
          if (result.rows.length === 1) {
              var responseBody = { coupon: result.rows[0].COUPONS };
              response.json(responseBody);
              doRelease(connection);
          } else {
              response.end();
              doRelease(connection);
          }
      });
  });
});

/**
 * POST /loyalty/v1/coupon/:userid
 * Consume 1 coupon and return coupon balance
 */
router.route('/v1/coupon/:userid').post(function (request, response) {
  console.log("CONSUME 1 COUPON and COUPON BALANCE BY ID:" + request.params.userid);
  oracledb.getConnection(connectionProperties, function (err, connection) {
      if (err) {
          console.error(err.message);
          response.status(500).send("Error connecting to DB");
          return;
      }
      var id = request.params.userid;
      connection.execute("SELECT COUPONS FROM CUSTOMER WHERE ID = :id",[id],
        { outFormat: oracledb.OBJECT },
        function (err, result) {
          if (err) {
              console.error(err.message);
              response.status(500).send("Error getting data from DB");
              doRelease(connection);
              return;
          }
          console.log("RESULTSET:" + JSON.stringify(result));
          if (result.rows.length === 1) {
              var user_coupons = result.rows[0].COUPONS;
              var responseBody;
              if (user_coupons === 0) {
                  responseBody = { coupon: 0 };
              } else {
                  connection.execute("UPDATE CUSTOMER SET COUPONS = COUPONS-1 WHERE ID = :id",[id],
                    { outFormat: oracledb.OBJECT },
                    function (err, result) {
                      if (err) {
                          console.error(err.message);
                          response.status(500).send("Error saving to DB");
                          doRelease(connection);
                          return;
                      } else {
                          responseBody = { coupon: user_coupons-1 };
                          response.json(responseBody);
                          doRelease(connection);
                      }
                  });
              }
          } else {
              response.end();
              doRelease(connection);
          }
      });
  });
});

/**
 * POST /loyalty/v1/login
 *   utility function for end user login
 */
router.route('/v1/login').post(function (request, response) {
  username = request.body.username;
  password = request.body.password;
  console.log("Login module trigger with user: " + username);
  oracledb.getConnection(connectionProperties, function (err, connection) {
    if (err) {
      // DB connection error
      console.error(err.message);
      response.status(500).send("Database connection error");
      return;
    } else {
      // got DB connection, lets process user login
      // let's query user now
      connection.execute("SELECT ID, PASSWORD FROM CUSTOMER WHERE UNAME = :username",[username],
        {outFormat: oracledb.OBJECT},
        function (err, result) {
          if (err) {
            // error when execute statement
            console.error(err.message);
            response.status(500).send("Error getting data from DB");
            doRelease(connection);
            return;
          } else {
            // select statement return result
            // let's see what is in the data
            console.log("RESULT SET: " + JSON.stringify(result));
            // there should only be one row, otherwise, login should failed
            if (result.rows.length === 1) {
              // only one row - let's check password
              // if success the response should be   {“result”:”success”, “memberno”: “10001”}
              dbpwd = result.rows[0].PASSWORD;
              if (dbpwd==password) {
                // password correct
                responseBody = { "result": "success", "memberno": result.rows[0].ID };
                response.json(responseBody);
                response.end();
                doRelease(connection);
              } else {
                // wrong password
                responseBody = { "result": "fail"};
                response.json(responseBody);
                response.end();
                doRelease(connection);
              }
            } else {
              // not exactly row.... either no row selected, i.e. no such user
              // or 2+ row... unlikely happen, something wrong with database table
              responseBody = { "result": "fail"};
              response.json(responseBody);
              response.end();
              doRelease(connection);
            }
          }
        })

    };
  })
});

/**
 * POST /loyalty/v1/activatereward/
 * Check loyalty program reward activation status
 *   reserved for future use
 */
router.route('/v1/activatereward/').get(function (request, response) {
  console.log("GET REWARD ACTIVATION STATUS");
  var responseBody = { activated: "true" };
  response.json(responseBody);
});

app.post('/initdb/resetdb', function (request,response) {
  console.log("reset or init db");
  console.log("db user received: " + request.body.username);
  console.log("db password received: " + request.body.password);
  // place holder for the function to init the db
  var responseBody = { "message": "Table created with one record"};
  response.json(responseBody);
  var initDBConn = {
    user: request.body.username,
    password: request.body.password,
    connectString: process.env.DB_DESCRIPTOR
  };
  oracledb.getConnection(initDBConn, function(err,connection)
  {
     if (err) {
       console.log("db connection error");
     }
     console.log("drop table, error might be fine");
     connection.execute("DROP TABLE customer", function(err,result) {
       if (err) {
         console.log("drop table error");
       }
       var createStatement = "CREATE TABLE CUSTOMER ( ID NUMBER, ";
           createStatement += "FIRSTNAME VARCHAR2(255), SURNAME VARCHAR2(255), ";
           createStatement += "ADDRESS VARCHAR2(255), CARDNUM VARCHAR2(255), ";
           createStatement += "POINTS NUMBER(*,0), COUPONS NUMBER(*,0), ";
           createStatement += "UNAME VARCHAR2(255), PASSWORD VARCHAR2(255), ";
           createStatement += "PRIMARY KEY(ID) )";
       connection.execute(createStatement, function(err, result) {
         if (err) {
           console.log("create table error");
         }
         var insertStatement = "INSERT INTO CUSTOMER values ";
             insertStatement += "(30001,'Lisa','Jones','64 Church Crescent, UK',";
             insertStatement += "'1111222233334444',1,6,'user@email.com','Oracle123')";
         connection.execute(insertStatement, function(err, result) {
           if (err) {
             console.log("insert record error");
           }
           connection.close();
         })

       })

     })
  });





});

router.route('/initdb.html').get(function (request,response) {
  console.log("init db form starts here");
  // place holder for the function to init the db
  var responseBody = "<html><body bgcolor=000000>";
  responseBody += "<font color=white face=arial>Please enter DB username/password:</font>";
  responseBody += "<form method=post action=/initdb/resetdb><input type=text name=username /><input type=password name=password /><input type=submit name=submit style='color: white'></body></html>";
  response.send(responseBody);
});

// serving H5 client under web folder
// this is the jet app and build with grunt
app.use(express.static(path.join(__dirname,'web')));
// route loyalty service API with router
app.use('/loyalty', router);

app.listen(PORT,function(){
  console.log("CafeSupremo client/server started at port " + PORT);
  console.log("database connection info: user: " + connectionProperties.user);
  console.log("database connection info: password: " + connectionProperties.password);
  console.log("database connection info: connectString: " + connectionProperties.connectString);
});
