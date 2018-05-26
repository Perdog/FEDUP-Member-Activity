var loginData = null;
var list = {};

$('#logout').click(function() {
	localStorage.removeItem("loginData");
	location.reload();
});

$(document).ready(function() {
	// Load server status into header
	//serverStatus();
	
	// Do we have a search location
	if (location.search) {
		// The user has logged in. Now we stash all the info we want and reload the web page.
		if (parseSearch("callback")) {
			var ex = Date.now() + (parseHash("expires_in")*1000);
			loginData =
			{
				token: parseHash("access_token"),
				expires: ex
			};
			localStorage.loginData = JSON.stringify(loginData);
			fetchCharInfo();
			return;
		}
	}
	
	// If login data exists, we need to make sure it's still valid.
	if (localStorage.loginData) {
		loginData = JSON.parse(localStorage.loginData);
		
		// If token has expired, then we need to log in again. Remove old data for funsies.
		if (loginData.expires < Date.now()) {
			localStorage.removeItem("loginData");
			showLogIn();
		}
		// Otherwise we're good to go. Let's load some thangs.
		else {
			$("#as").find("img").attr("src", "https://image.eveonline.com/Character/" + loginData.id + "_32.jpg");
			$("#corp-logo").attr("src", "https://image.eveonline.com/Corporation/" + loginData.corp_id + "_128.png");
			$("#logged-name").text("Logged in as " + loginData.name + ": ");
			$("#as").show();
			$("#corp-logo").show();
			
			setTimeout(tickTimer, 1000);
			
			if (loginData.has_roles == undefined)
				checkRoles();
			else
				loadThingsOntoPage();
		}
	}
	// Otherwise, we know they aren't logged in.
	else {
		showLogIn();
	}
});

function showLogIn() {
	$('#login').show();
	$('#please-login').show();
}

function serverStatus() {
	var fetch = new XMLHttpRequest();
	fetch.onload = serverStatusLoad;
	fetch.onerror = serverStatusError;
	fetch.open('get', "https://esi.evetech.net/latest/status/?datasource=tranquility", true);
	fetch.send();
}

function serverStatusLoad() {
	var data = JSON.parse(this.responseText);
	var isOn = data.players > 0;
	$('#server-status').text("Server is " + (isOn ? "online" : "offline") + " --- Players online: " + data.players);
}

function serverStatusError(err) {
	$('#server-status').text("Error loading server status");
}

function fetchCharInfo() {
	var fetch = new XMLHttpRequest();
	fetch.onload = charLoad;
	fetch.onerror = charError;
	fetch.open('get', "https://esi.tech.ccp.is/verify/", true);
	fetch.setRequestHeader("Authorization", "Bearer " + loginData.token);
	fetch.send();
}

function charLoad() {
	var data = JSON.parse(this.responseText);
	loginData.name = data.CharacterName;
	loginData.id = data.CharacterID;
	localStorage.loginData = JSON.stringify(loginData);
	
	var fetch = new XMLHttpRequest();
	fetch.onload = fetchPublicLoad;
	fetch.onerror = fetchPublicError;
	fetch.open('get', "https://esi.evetech.net/latest/characters/" + loginData.id + "/?datasource=tranquility", true);
	//fetch.setRequestHeader("Authorization", "Bearer " + token);
	fetch.send();
}

function charError(err) {
	$('#as').find("a").text("Error loading character info");
}

function fetchPublicLoad() {
	var data = JSON.parse(this.responseText);
	loginData.corp_id = data.corporation_id;
	localStorage.loginData = JSON.stringify(loginData);
	location = location.href.split('?')[0];
}

function fetchPublicError(err) {
	alert("Error loading character public data in the background. Please log out and log in again");
}

function checkRoles() {
	var fetch = new XMLHttpRequest();
	fetch.onload = rolesLoad;
	fetch.onerror = rolesError;
	fetch.open('get', "https://esi.evetech.net/latest/characters/" + loginData.id + "/roles/?datasource=tranquility", true);
	fetch.setRequestHeader("Authorization", "Bearer " + loginData.token);
	fetch.send();
}

function rolesLoad() {
	var data = JSON.parse(this.responseText);
	
	if (data.error) {
		alert("Error loading character roles: " + data.error);
		console.error("Error loading character roles: " + data.error);
	}
	
	loginData.has_roles = data.roles.includes("Director");
	localStorage.loginData = JSON.stringify(loginData);
	
	// Track if character is a director to make life easier later on.
	if (!loginData.has_roles) {
		$('#limited-features').show();
	}
	loadThingsOntoPage();
}

function rolesError(err) {
	alert("Error loading character roles: " + err);
	console.error("Error loading character roles: " + err);
}

function loadThingsOntoPage() {
	/*
	I'd love to use flags, don't know how handy it would be though. Also not sure the best way to display all this info.
	
	Things we need to load:
		- Character inactivity:
			- Requires: Director
			- Endpoint: https://esi.evetech.net/latest/corporations/<corpID>/membertracking/?datasource=tranquility --Header Bearer <token>
			- Check for logout time greater then 30 days. Add to purge list.
		- Character participation:
			- Requires: Nothing except character ID
			- Endpoints:
				- IDs: https://esi.evetech.net/latest/corporations/<corpID>/members/?datasource=tranquility
				- zKill: 
			- Load last 100 entries for character on ZKill
				- This... might take a while
			- Check for most recent kill/lose, as well as "activity level" (How close together the dates of the kills are)
		- Character titles:
			- Requires: Director
			- Endpoint: https://esi.evetech.net/latest/corporations/<corpID>/members/titles/?datasource=tranquility
			- List character titles along with their names
	*/
	
	fetchInactiveMembers();
	
	$('#logged-in').show();
}

function fetchInactiveMembers() {
	var fetch = new XMLHttpRequest();
	fetch.onload = loadInactiveMembers;
	//fetch.onerror = charError;
	fetch.open('get', "https://esi.evetech.net/latest/corporations/" + loginData.corp_id + "/membertracking/?datasource=tranquility", true);
	fetch.setRequestHeader("Authorization", "Bearer " + loginData.token);
	fetch.send();
}

function loadInactiveMembers() {
	var json = JSON.parse(this.responseText);
	var ids = [];
	
	if (json.error) {
		console.log("Error doing membertracking stuff: ", json.error);
		return;
	}
	
	var cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - 30);
	for (var key in json) {
		var breakDown = json[key].logon_date.split("T");
		var lastLogin = new Date(breakDown[0]);
		var joined = new Date(json[key].start_date.split("T")[0]);
		
		if (lastLogin < cutoff) {
			ids.push(json[key].character_id);
			/*
			var charName = getCharName(json[key].character_id)+"";
			var temp = [charName, lastLogin, joined];
			list.push(temp);
			*/
			var temp = {"last_on": lastLogin, "joined": joined};
			list[json[key].character_id] = temp;
		}
	}
	/*
	if (list.length < 1) {
		list.push(["Whoops", "No data"]);
	}
	
	list.sort(function(a,b) {
		if(a[0].toUpperCase() > b[0].toUpperCase()) return 1;
		else if (a[0].toUpperCase() < b[0].toUpperCase()) return -1;
		else return 0;
	});
	*/
	lookupCharIDs(ids);
	
	//console.log(list);
}

function lookupCharIDs(ids) {
	var fetch = new XMLHttpRequest();
	fetch.onload = lookupDone;
	//fetch.onerror = rolesError;
	fetch.open('get', "https://esi.evetech.net/latest/characters/names/?character_ids=" + ids.toString() + "&datasource=tranquility", true);
	//fetch.setRequestHeader("Authorization", "Bearer " + loginData.token);
	fetch.send();
}

function lookupDone() {
	var data = JSON.parse(this.responseText);
	var tableText = "";
	
	for (var i = 0; i < data.length; i++) {
		//list[data[i].character_id].name = data[i].character_name;
		var m = list[data[i].character_id];
		tableText += 	"<tr>" + 
						"<td>" + data[i].character_name + "</td>" +
						"<td>" + m.joined.toString().substring(3,15) + "</td>" +
						"<td>" + m.last_on.toString().substring(3,15) + "</td>" +
						"<td>" + parseTimer(Date.now() - new Date(m.last_on)) + "</td>" +
						"</tr>";
	}
	
	$('#inactive-table').append(tableText);
	$('#inactive-table').show();
	console.log(list);
	
	
}

function parseSearch(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');
        if (decodeURIComponent(pair[0]) == variable) {
            return decodeURIComponent(pair[1]);
        }
    }
    console.log('Search variable %s not found', variable);
}

function parseHash(variable) {
    var query = window.location.hash.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');
        if (decodeURIComponent(pair[0]) == variable) {
            return decodeURIComponent(pair[1]);
        }
    }
    console.log('Hash variable %s not found', variable);
}

function parseTimer(duration) {
	var seconds = parseInt((duration/1000)%60);
	var minutes = parseInt((duration/(1000*60))%60);
	var hours = parseInt((duration/(1000*60*60))%24);
	var days = parseInt((duration/(1000*60*60*24))%30);
	var months = parseInt((duration/(1000*60*60*24*30)%12));
	months = (months > 0) ? months + "mo" : "";
	days = (days > 0) ? days + "D" : "";
	hours = (hours > 0) ? ((hours < 10) ? "0" + hours : hours) + "H" : "";
	minutes = (minutes > 0) ? minutes + "M" : "";
	seconds = ((seconds < 10) ? "0" + seconds : seconds);
	
	return ((months != "") ? months + ":" : "") + ((days != "") ? days + ":" : "") + ((hours != "") ? hours + ":" : "") + ((minutes != "") ? minutes + ":" : "" ) + seconds + "S";
}

function tickTimer() {
	var remain = loginData.expires - Date.now();
	
	if (remain <= 0) {
		$("#timer").text(parseTimer(remain));
		$('#as').hide();
		$('#login').show();
		alert("Your session has expired.\nYou'll need to log in again if you reload this site.");
	}
	else {
		$("#timer").text(parseTimer(remain));
		setTimeout(tickTimer, 1000);
	}
}

function getCharName(id) {
	return id;
}

