var loginData = null;
var list = {};
var kbdata = [];

$('#logout').click(function() {
	localStorage.removeItem("loginData");
	location.reload();
});

$(document).ready(function() {
	// Load server status into header
	//serverStatus();
	$('#nav-tabs').tabs();
	
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

// Show log in button and help text
function showLogIn() {
	$('#login').show();
	$('#please-login').show();
}

// Fire XHR request for server data
function serverStatus() {
	var fetch = new XMLHttpRequest();
	fetch.onload = serverStatusLoad;
	fetch.onerror = serverStatusError;
	fetch.open('get', "https://esi.evetech.net/latest/status/?datasource=tranquility", true);
	fetch.send();
}

// Catch server data response
function serverStatusLoad() {
	var data = JSON.parse(this.responseText);
	var isOn = data.players > 0;
	$('#server-status').text("Server is " + (isOn ? "online" : "offline") + " --- Players online: " + data.players);
}

// Catch server data errors
function serverStatusError(err) {
	$('#server-status').text("Error loading server status");
}

// Fire XHR for verifying a token
function fetchCharInfo() {
	var fetch = new XMLHttpRequest();
	fetch.onload = charLoad;
	fetch.onerror = charError;
	fetch.open('get', "https://esi.tech.ccp.is/verify/", true);
	fetch.setRequestHeader("Authorization", "Bearer " + loginData.token);
	fetch.send();
}

// Catch verify response
function charLoad() {
	var data = JSON.parse(this.responseText);
	console.log(data);
	loginData.name = data.CharacterName;
	loginData.id = data.CharacterID;
	// DEBUG
	loginData.tokenExpires = data.ExpiresOn;
	/*
	var ex = new Date(data.expiresOn);
	loginData.expires = Date.now() + ex;
	*/
	localStorage.loginData = JSON.stringify(loginData);
	
	var fetch = new XMLHttpRequest();
	fetch.onload = fetchPublicLoad;
	fetch.onerror = fetchPublicError;
	fetch.open('get', "https://esi.evetech.net/latest/characters/" + loginData.id + "/?datasource=tranquility", true);
	//fetch.setRequestHeader("Authorization", "Bearer " + token);
	fetch.send();
}

// Catch verify errors
function charError(err) {
	$('#as').find("a").text("Error loading character info");
}

function fetchPublicLoad() {
	var data = JSON.parse(this.responseText);
	loginData.corp_id = data.corporation_id;
	localStorage.loginData = JSON.stringify(loginData);
	console.log("Retrived all data, reloading page");
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
	fetch.open('get', "https://esi.evetech.net/latest/corporations/" + loginData.corp_id + "/membertracking/?datasource=tranquility", true);
	fetch.setRequestHeader("Authorization", "Bearer " + loginData.token);
	fetch.send();
}

function loadInactiveMembers() {
	var json = JSON.parse(this.responseText);
	var allids = [];
	var ids = [];
	
	if (json.error) {
		console.log("Error doing membertracking stuff: %1", json.error);
		return;
	}
	
	var cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - 30);
	for (var key in json) {
		var breakDown = json[key].logon_date.split("T");
		var lastLogin = new Date(breakDown[0]);
		var joined = new Date(json[key].start_date.split("T")[0]);
		
		allids.push(json[key].character_id);
		
		if (lastLogin < cutoff) {
			ids.push(json[key].character_id);
			var temp = {"last_on": lastLogin, "joined": joined};
			list[json[key].character_id] = temp;
		}
	}
	
	lookupKillboards(allids);
	lookupCharIDs(ids);
}

function lookupKillboards(ids) {
	statsMax = ids.length;
	for (var i = 0; i < ids.length; i++) {
		var fetch = new XMLHttpRequest();
		fetch.onload = loadKillboards;
		fetch.open('get', "https://zkillboard.com/api/stats/characterID/" + ids[i] + "/", true);
		fetch.send();
	}
}

var statsMax = 0;
var statsLoaded = 0;
function loadKillboards() {
	var data = JSON.parse(this.responseText);
	var date = new Date();
	var thisMonth = Number(date.getFullYear() + "" + (date.getMonth()+1 < 10 ? "0"+(date.getMonth()+1) : date.getMonth()+1));
	var lastMonth = Number(date.getFullYear() + "" + (date.getMonth() === 0 ? 12 : (date.getMonth() < 10 ? "0"+date.getMonth() : date.getMonth())));
	
	var allTime = "";
	
	var corpKills = data.topAllTime;
	if (!corpKills) {
		corpKills = {};
		corpKills.data = [{kills: 0}];
	} else {
		corpKills = corpKills[1];
	}
	
	var temp = 	{
					name: (data.info ? data.info.name : "Unknown"),
					all_time: corpKills.data[0].kills,
					this_month: (data.months ? (data.months[thisMonth] ? (data.months[thisMonth].shipsDestroyed ? data.months[thisMonth].shipsDestroyed : 0) : 0) : 0),
					last_month: (data.months ? (data.months[lastMonth] ? (data.months[lastMonth].shipsDestroyed ? data.months[lastMonth].shipsDestroyed : 0) : 0) : 0),
				};
	
	kbdata.push(temp);
	
	statsLoaded++;
	if (statsLoaded === statsMax)
		showKillboard();
}

function showKillboard() {
	kbdata.sort(function (a, b) {
		if (a.this_month > b.this_month)
			return 1;
		else if (a.this_month < b.this_month)
			return -1;
		else {
			if (a.all_time > b.all_time)
				return 1;
			else if (a.all_time < b.all_time)
				return-1;
			else {
				if (a.name.toLowerCase() > b.name.toLowerCase())
					return 1;
				else if (a.name.toLowerCase() < b.name.toLowerCase())
					return -1;
			}
			
			return 0;
		}
	});
	var killTable = "";
	
	for (var i = 0; i < kbdata.length; i++) {
		killTable += 	"<tr>" +
							"<td>" + kbdata[i].name + "</td>" +
							"<td>" + kbdata[i].all_time + "</td>" +
							"<td>" + kbdata[i].this_month + "</td>" +
							"<td>" + kbdata[i].last_month + "</td>" +
						"</tr>"
	}
	
	$('#killboard-activity').append(killTable);
}

function lookupCharIDs(ids) {
	var fetch = new XMLHttpRequest();
	fetch.onload = loadCharIDs;
	fetch.open('post', "https://esi.evetech.net/latest/universe/names/?datasource=tranquility", true);
	fetch.send(JSON.stringify(ids));
}

function loadCharIDs() {
	var data = JSON.parse(this.responseText);
	var tableText = "";
	
	if (data.error) {
		console.log(data.error);
		return;
	}
	
	data.sort(function(a,b) {
		var aName = a.name.toLowerCase();
		var bName = b.name.toLowerCase();
		if (aName > bName)
    			return 1;
    		if (aName < bName)
    			return -1;
    		else
    			return 0;
	});
	
	for (var i = 0; i < data.length; i++) {
		//list[data[i].id].name = data[i].name;
		var m = list[data[i].id];
		tableText += 	"<tr>" + 
						"<td>" + (i+1) + "</td>" +
						"<td>" + data[i].name + "</td>" +
						"<td>" + m.joined.toString().substring(3,15) + "</td>" +
						"<td>" + m.last_on.toString().substring(3,15) + "</td>" +
						"<td>" + parseTimer(Date.now() - new Date(m.last_on)) + "</td>" +
						"</tr>";
	}
	
	$('#inactive-table').find('tbody').append(tableText);
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
	var years = parseInt((duration/(1000*60*60*24*30*12)));
	years = (years > 0) ? years + "y" : "";
	months = (months > 0) ? months + "mo" : "";
	days = (days > 0) ? days + "D" : "";
	hours = (hours > 0) ? ((hours < 10) ? "0" + hours : hours) + "H" : "";
	minutes = (minutes > 0) ? minutes + "M" : "";
	seconds = ((seconds < 10) ? "0" + seconds : seconds);
	
	return ((years != "") ? years + ":" : "") + ((months != "") ? months + ":" : "") + ((days != "") ? days + ":" : "") + ((hours != "") ? hours + ":" : "") + ((minutes != "") ? minutes + ":" : "" ) + seconds + "S";
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

function sortTable() {
  var table, rows, switching, i, x, y, shouldSwitch;
  table = document.getElementById("inactive-table");
  switching = true;
  /*Make a loop that will continue until
  no switching has been done:*/
  while (switching) {
    //start by saying: no switching is done:
    switching = false;
    rows = table.getElementsByTagName("TR");
    /*Loop through all table rows (except the
    first, which contains table headers):*/
    for (i = 1; i < (rows.length - 1); i++) {
      //start by saying there should be no switching:
      shouldSwitch = false;
      /*Get the two elements you want to compare,
      one from current row and one from the next:*/
      x = (rows[i].getElementsByTagName("TD")[0]);
      y = (rows[i + 1].getElementsByTagName("TD")[0]);
      //check if the two rows should switch place:
      if (x.innerHTML.toLowerCase() > y.innerHTML.toLowerCase()) {
        //if so, mark as a switch and break the loop:
        shouldSwitch = true;
        break;
      }
    }
    if (shouldSwitch) {
      /*If a switch has been marked, make the switch
      and mark that a switch has been done:*/
      rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
      switching = true;
    }
  }
}

