package authproxy

import (
    "net/http"
)

func init() {
    http.HandleFunc("/json", jsonHandler)
    http.HandleFunc("/spotify", spotifyHandler)
}


func jsonHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.Header().Set("Access-Control-Allow-Origin", "*")
    w.Write([]byte("{ \"access_token\": \"" + r.FormValue("access_token") + "\" }"))
}

func spotifyHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.Header().Set("Access-Control-Allow-Origin", "*")
    w.Write([]byte("{ \"code\": \"" + r.FormValue("code") + "\" }"))
}
