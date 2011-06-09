function getSettings()
{
    var response = new Object();
    response.name = "HTML API TESTER Resolver";
    response.weight = 100;
    response.timeout = 5;

    return response;
}

function resolve( qid, artist, album, track ){
  if (!!window.openDatabase) {
    try {
      var db1 = window.openDatabase('mydb', '1.0', 'my first database', 2 * 1024 * 1024);
      db1.transaction(function (tx) {
        tx.executeSql('SELECT * FROM foo', [], function(tx, results) {
                 for (var i = 0 , len = results.rows.length; i < len; i++) {
                     console.debug("||||||||||||||||||||||||"+results.rows.item(i).text+"||||||||||||||||||||||||||||||")
                 }
             });
      });
    }catch(e){}
  };
  if (window.sessionStorage["storeme"]) {
    console.log("|||||||||||||||||||||||||||sessionStorage saving accross requests works|||||||||||||||||||||||||||||")
  };

  if (window.sessionStorage) {
    console.log("|||||||||||||||||||||||||||sessionStorage works|||||||||||||||||||||||||||||")
    window.sessionStorage["storeme"] = "test if sore works"
  };

  if (window.localStorage) {
    console.log("|||||||||||||||||||||||||||localstorage works|||||||||||||||||||||||||||||")
  };

  if (!!window.openDatabase) {
    try {
      var db = openDatabase('mydb', '1.0', 'my first database', 2 * 1024 * 1024);
      db.transaction(function (tx) {
          tx.executeSql('CREATE TABLE IF NOT EXISTS foo (id unique, text)');
          tx.executeSql('INSERT INTO foo (id, text) VALUES (1, "websql loading accross sessions works")');
          console.log("|||||||||||||||||||||||||||websql storing works|||||||||||||||||||||||||||||")
      });
    }catch(e){}
  };

  return false;
}