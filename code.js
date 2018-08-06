var loginData = null;
var allIDs = [];
var purgeIDs = [];
var list = [];
var kbdata = [];

var stasisList = [];
var purgedList = [];
var dnpList = [];

var purgeState = {
	Default: "",
	Stasis: "rgb(128, 128, 0)",
	Dnp: "rgb(128, 0, 0)",
	Purged: "rgb(0, 128, 0)",
};

$('tbody').on("click", "tr", function(e) {
	console.log($(this).css('background-color'));
	
	switch ($(this).css('background-color')) {
		case purgeState.Dnp:
			$(this).css('background-color', '');
			dnpList.splice(dnpList.indexOf("#" + this.id), 1);
			break;
		case purgeState.Purged:
			var id = "#" + this.id;
			$(this).css('background-color', purgeState.Dnp);
			purgedList.splice(purgedList.indexOf(id), 1);
			dnpList.push(id);
			break;
		case purgeState.Stasis:
			var id = "#" + this.id;
			$(this).css('background-color', purgeState.Purged);
			stasisList.splice(stasisList.indexOf(id), 1);
			purgedList.push(id);
			break;
		case purgeState.Default:
			console.log("Probably shouldn't ever see this");
			break;
		default:
			console.log("Normal color");
			$(this).css('background-color', purgeState.Stasis);
			stasisList.push("#" + this.id);
			break;
	}
	
	localStorage.stasis = JSON.stringify(stasisList);
	localStorage.purged = JSON.stringify(purgedList);
	localStorage.dnp = JSON.stringify(dnpList);
});

$('#logout').click(function() {
	localStorage.removeItem("loginData");
	location.reload();
});

$(document).ready(function() {
	// Load server status into header
	//serverStatus();
	
	// Load all of the stored values into memory
	if (localStorage.stasis)
		stasisList = JSON.parse(localStorage.stasis);
	if (localStorage.purged)
		purgedList = JSON.parse(localStorage.purged);
	if (localStorage.dnp)
		dnpList = JSON.parse(localStorage.dnp);
	
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
	
	if (loginData.has_roles)
		fetchInactiveMembers();
	else
		fetchMemberIDs();
	
	$('#logged-in').show();
}

function fetchMemberIDs() {
	var fetch = new XMLHttpRequest();
	fetch.onload = loadMemberIDs;
	fetch.open('get', "https://esi.evetech.net/latest/corporations/" + loginData.corp_id + "/members/?datasource=tranquility", true);
	fetch.setRequestHeader("Authorization", "Bearer " + loginData.token);
	fetch.send();
}

function loadMemberIDs() {
	var data = JSON.parse(this.responseText);
	
	if (data.error) {
		console.log("Error loading member IDs: %1", json.error);
		return;
	}
	$('#nav-tabs').tabs("option", "active", 1);
	allIDs = data;
	lookupKillboards();
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
	
	if (json.error) {
		console.log("Error loading member info: %1", json.error);
		return;
	}
	
	var cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - 30);
	for (var key in json) {
		var breakDown = json[key].logon_date.split("T");
		var lastLogin = new Date(breakDown[0]);
		var joined = new Date(json[key].start_date.split("T")[0]);
		var toPurge = (lastLogin < cutoff);
		
		allIDs.push(json[key].character_id);
		if (toPurge)
			purgeIDs.push(json[key].character_id);
		
		var temp = {"id": json[key].character_id, "purge": toPurge, "last_on": lastLogin, "joined": joined};
		list.push(temp);
	}
	
	lookupKillboards();
	lookupCharIDs();
}

function lookupKillboards() {
	for (var i = 0; i < allIDs.length; i++) {
		var fetch = new XMLHttpRequest();
		fetch.onload = loadKillboards;
		fetch.open('get', "https://zkillboard.com/api/stats/characterID/" + allIDs[i] + "/", true);
		fetch.send();
	}
}

var statsLoaded = 0;
function loadKillboards() {
	var data = JSON.parse(this.responseText);
	
	var id = (data.info ? (data.info.id ? data.info.id : 0) : 0);
	if (id === 0) {
		statsLoaded++;
		console.log("Failed");
		return;
	}
	
	var member = list.filter(e => e.id == id);
	if (member)
		member = member[0];
	
	var date = new Date();
	var thisMonth = Number(date.getFullYear() + "" + (date.getMonth()+1 < 10 ? "0"+(date.getMonth()+1) : date.getMonth()+1));
	var lastMonth = Number(date.getFullYear() + "" + (date.getMonth() === 0 ? 12 : (date.getMonth() < 10 ? "0"+date.getMonth() : date.getMonth())));
	
	var allTime;
	
	var corpKills = data.topAllTime;
	if (!corpKills) {
		corpKills = {};
		corpKills.data = [{kills: 0}];
	} else {
		corpKills = corpKills[1];
		
		allTime = corpKills.data.filter(e => e.corporationID == data.info.corporationID);
	}
	
	var temp = 	{
					id: id,
					name: (data.info ? data.info.name : "Unknown"),
					purge: (member ? (member.purge ? "Yes" : "") : ""),
					joined: (member ? member.joined : ""),
					last: (member ? member.last_on : ""),
					all_time: (allTime && allTime[0] && allTime[0].kills ? allTime[0].kills : 0),
					this_month_kills: (data.months ? (data.months[thisMonth] ? (data.months[thisMonth].shipsDestroyed ? data.months[thisMonth].shipsDestroyed : 0) : 0) : 0),
					this_month_losses: (data.months ? (data.months[thisMonth] ? (data.months[thisMonth].shipsLost ? data.months[thisMonth].shipsLost : 0) : 0) : 0),
					last_month_kills: (data.months ? (data.months[lastMonth] ? (data.months[lastMonth].shipsDestroyed ? data.months[lastMonth].shipsDestroyed : 0) : 0) : 0),
					last_month_losses: (data.months ? (data.months[lastMonth] ? (data.months[lastMonth].shipsLost ? data.months[lastMonth].shipsLost : 0) : 0) : 0),
				};
	
	kbdata.push(temp);
	
	statsLoaded++;
	if (statsLoaded === allIDs.length)
		showKillboard();
}

function showKillboard() {
	
	kbdata.sort(function (a, b) {
		if (a.this_month_kills > b.this_month_kills)
			return 1;
		else if (a.this_month_kills < b.this_month_kills)
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
	
	$('#killboard-activity').find('thead').append(
					"<tr>" +
						"<th onclick=\"sortTable(2,1)\">Name</th>" +
						(loginData.has_roles ? "<th onclick=\"sortTable(2,2)\">Purge?</th>" : "") +
						(loginData.has_roles ? "<th onclick=\"sortTable(2,3)\">Join date</th>" : "") +
						(loginData.has_roles ? "<th onclick=\"sortTable(2,4)\">Last login</th>" : "") +
						"<th onclick=\"sortTable(2,5)\">All time kills in corp</th>" +
						"<th onclick=\"sortTable(2,6)\">This month: Killes/Losses</th>" +
						"<th onclick=\"sortTable(2,7)\">Last month: Killes/Losses</th>" +
					"</tr>");
	
	for (var i = 0; i < kbdata.length; i++) {
		killTable += 	"<tr id='kb-"+kbdata[i].name.replace(/ /gi, "-")+"'>" +
							"<td><a target=\"_blank\" href=\"https://zkillboard.com/character/"+kbdata[i].id+"/\">" + kbdata[i].name + "</a></td>" +
							(loginData.has_roles ? ("<td>" + kbdata[i].purge + "</td>") : "") +
							(loginData.has_roles ? ("<td>" + kbdata[i].joined.toString().substring(3,15) + "</td>") : "") +
							(loginData.has_roles ? ("<td>" + kbdata[i].last.toString().substring(3,15) + "</td>") : "") +
							"<td>" + kbdata[i].all_time + "</td>" +
							"<td>" + kbdata[i].this_month_kills + "/" + kbdata[i].this_month_losses + "</td>" +
							"<td>" + kbdata[i].last_month_kills + "/" + kbdata[i].last_month_losses + "</td>" +
						"</tr>"
	}
	
	$('#killboard-activity').find('tbody').append(killTable);
	assignBackgrounds();
}

function lookupCharIDs() {
	var fetch = new XMLHttpRequest();
	fetch.onload = loadCharIDs;
	fetch.open('post', "https://esi.evetech.net/latest/universe/names/?datasource=tranquility", true);
	fetch.send(JSON.stringify(purgeIDs));
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
		var m = list.filter(e => e.id == data[i].id)[0];
		tableText += 	"<tr id='inact-"+data[i].name.replace(/ /gi, "-")+"'>" + 
							"<td>" + (i+1) + "</td>" +
							"<td>" + data[i].name + "</td>" +
							"<td>" + m.joined.toString().substring(3,15) + "</td>" +
							"<td>" + m.last_on.toString().substring(3,15) + "</td>" +
							"<td>" + parseTimer(Date.now() - new Date(m.last_on), true) + "</td>" +
						"</tr>";
	}
	
	$('#purge-tab').show();
	$('#inactive-table').find('tbody').append(tableText);
	assignBackgrounds();
}

function assignBackgrounds() {
	// Loop through the lists and color the rows
	stasisList.forEach(function(e) {
		$(e).css('background-color', purgeState.Stasis);
		console.log($(e));
		console.log("Found someone in stasis");
	});
	purgedList.forEach(function(e) {
		$(e).css('background-color', purgeState.Purged);
		console.log($(e));
		console.log("Found someone already purged");
	});
	dnpList.forEach(function(e) {
		$(e).css('background-color', purgeState.Dnp);
		console.log($(e));
		console.log("Found someone who shouldn't be purged");
	});
	
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

function parseTimer(duration, largeOnly) {
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
	
	if (largeOnly)
		return ((years != "") ? years + ":" : "") + ((months != "") ? months : "0mo") + ((days != "") ? ":"+days : "");
	else
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

function sortTable(page, n) {
	$('body').addClass('waiting');
	
	setTimeout(function() {
	var table, rows, switching, switchCount = 0, i, x, y, shouldSwitch, dir = "asc", changedDir = false;
		
	n -= 1;
	
	/* Add this little catch for trying to sort the last row of purge data.
	The 2 last rows show the same data, except in different forms.
	We bump n back to sort the row with sortable data, and we swap the sort direction
	since the last row shows the data reversed.*/
	if (page == 1 && n == 4) {
		dir = "desc";
		n = 3;
	}
	
	console.log("Sorting table " + page + ", column " + n);
	
	table = (page == 1 ? document.getElementById("inactive-table") : (page == 2 ? document.getElementById("killboard-activity") : null));
	
	if (!table) {
		console.log("No table selected");
		return;
	}
	
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
			x = (rows[i].getElementsByTagName("TD")[n]);
			y = (rows[i + 1].getElementsByTagName("TD")[n]);
			
			//check if the two rows should switch place:
			if (shouldWe(x, y, page, n, dir)) {
				//if so, mark as a switch, count it, and break the loop:
				shouldSwitch = true;
				switchCount++;
				break;
			}
		}
		if (shouldSwitch) {
			/*If a switch has been marked, make the switch
			and mark that we need to continue.*/
			rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
			switching = true;
		} else if (switchCount == 0) {
			/* If no switch has been made, check if we've made any switches at all.
			If not, we're already sorted ascending and need to reverse it.*/
			if (dir == "asc" && !changedDir) {
				console.log("Switching to descending");
				dir = "desc";
				switching = true;
				changedDir = true;
			} else if (dir == "desc" && !changedDir) {
				console.log("Switching to ascending");
				dir = "asc";
				switching = true;
				changedDir = true;
			}
		} else {
			console.log(switchCount + " swaps made");
		}
	}
	
	$('body').removeClass('waiting');
	
	}, 500);
}

function shouldWe(x, y, table, n, dir) {
	// Check which table we are focused on first
	if (table == 1) { // Purge table
		
		switch(n) {
			case 1:
				if (dir == "asc") {
					if (x.innerHTML.toLowerCase() > y.innerHTML.toLowerCase())
						return true;
				} else {
					if (x.innerHTML.toLowerCase() < y.innerHTML.toLowerCase())
						return true;
				}
				return false;
			case 2:
				if (dir == "asc") {
					if (new Date(x.innerHTML) > new Date(y.innerHTML))
						return true;
				} else {
					if (new Date(x.innerHTML) < new Date(y.innerHTML))
						return true;
				}
				return false;
			case 3:
				if (dir == "asc") {
					if (new Date(x.innerHTML) > new Date(y.innerHTML))
						return true;
				} else {
					if (new Date(x.innerHTML) < new Date(y.innerHTML))
						return true;
				}
				return false;
		}
		
	} else if (table == 2) { // Killboard activity
		
		switch(n) {
			case 0:
				if (dir == "asc") {
					if (x.firstElementChild.innerHTML.toLowerCase() > y.firstElementChild.innerHTML.toLowerCase())
						return true;
				} else {
					if (x.firstElementChild.innerHTML.toLowerCase() < y.firstElementChild.innerHTML.toLowerCase())
						return true;
				}
				return false;
			case 1:
				if (dir == "asc") {
					if (x.innerHTML.toLowerCase() > y.innerHTML.toLowerCase())
						return true;
				} else {
					if (x.innerHTML.toLowerCase() < y.innerHTML.toLowerCase())
						return true;
				}
				return false;
			case 2:
				if (dir == "asc") {
					if (new Date(x.innerHTML) > new Date(y.innerHTML))
						return true;
				} else {
					if (new Date(x.innerHTML) < new Date(y.innerHTML))
						return true;
				}
				return false;
			case 3:
				if (dir == "asc") {
					if (new Date(x.innerHTML) > new Date(y.innerHTML))
						return true;
				} else {
					if (new Date(x.innerHTML) < new Date(y.innerHTML))
						return true;
				}
				return false;
			case 4:
				if (dir == "asc") {
					if (Number(x.innerHTML.toLowerCase()) > Number(y.innerHTML.toLowerCase()))
						return true;
				} else {
					if (Number(x.innerHTML.toLowerCase()) < Number(y.innerHTML.toLowerCase()))
						return true;
				}
				return false;
			case 5:
				// Fall through. Same sort method.
			case 6:
				var xs = x.innerHTML.split("/");
				var ys = y.innerHTML.split("/");
				
				var xk = Number(xs[0]);
				var xl = Number(xs[1]);
				var yk = Number(ys[0]);
				var yl = Number(ys[1]);
				
				if (dir == "asc") {
					if (xk > yk)
						return true;
					else if (xk == yk && xl > yl)
						return true;
				} else {
					if (xk < yk)
						return true;
					else if (xk == yk && xl < yl)
						return true;
				}
				return false;
		}
		
	}
}

