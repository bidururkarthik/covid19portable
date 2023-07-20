const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();

app.use(express.json());

const dbpath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const intialsetdatavaseserver = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("server running http://localhost:3000");
    });
  } catch (error) {
    console.log(`database error ${error.message}`);
    process.exit(1);
  }
};

intialsetdatavaseserver();

function convertstatedetails(object) {
  return {
    stateId: object.state_id,
    stateName: object.state_name,
    population: object.population,
  };
}

function districtdetails(object) {
  return {
    districtId: object.district_id,
    districtName: object.district_name,
    stateId: object.state_id,
    cases: object.cases,
    cured: object.cured,
    active: object.active,
    deaths: object.deaths,
  };
}

const authurization = (request, response, next) => {
  let jwtToken;
  const autheaders = request.headers["authorization"];

  if (autheaders !== undefined) {
    jwtToken = autheaders.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_KEY", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const checking_username_query = `SELECT * FROM user WHERE username = '${username}'`;
  const dbresponse = await db.get(checking_username_query);

  if (dbresponse === undefined) {
    response.status(400);
    response.send("Invaild user");
  } else {
    const check_password = await bcrypt.compare(password, dbresponse.password);
    if (check_password === true) {
      const payload = {
        username: username,
      };

      const jwtToken = jwt.sign(payload, "MY_KEY");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API2
app.get("/states/", authurization, async (request, response) => {
  const alldetailsstatequery = `
    SELECT
    *
    FROM
    state
    `;
  const stateArray = await db.get(alldetailsstatequery);
  response.send(convertstatedetails(stateArray));
});

//API3
app.get("/states/:stateId/", authurization, async (request, response) => {
  const { stateId } = request.params;
  const specific_stateId_query = `
    SELECT
    *
    FROM
    state
    WHERE
    state_id = ${stateId}
    `;
  const state = await db.get(specific_stateId_query);
  response.send(convertstatedetails(state));
});

//API4
app.post("/districts/", authurization, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const create_new_district_detail = `
    INSERT INTO
    district (district_name,state_id,cases,cured ,active,deaths)
    VALUES(
        '${districtName}',
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths}
    )
    `;
  await db.run(create_new_district_detail);
  response.send("District Successfully Added");
});

//API5
app.get("/districts/:districtId/", authurization, async (request, response) => {
  const { districtId } = request.params;
  const specific_get_details_from_district = `
    SELECT
    *
    FROM
    district
    WHERE
    district_id = ${districtId}
    `;
  const district = await db.get(specific_get_details_from_district);
  response.send(districtdetails(district));
});

//API6
app.delete(
  "/districts/:districtId/",
  authurization,
  async (request, response) => {
    const { districtId } = request.params;
    const delete_specific_id = `
    DELETE
    FROM
    district
    WHERE
    district_id = ${districtId}
    `;
    await db.run(delete_specific_id);
    response.send("District Removed");
  }
);

//API7
app.put("/districts/:districtId/", authurization, async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const update_district_details = `
    UPDATE
    district
    SET
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
    WHERE
    district_id = ${districtId}
    `;
  await db.run(update_district_details);
  response.send("District Details Updated");
});

//API8
app.get("/states/:stateId/stats/", authurization, async (request, response) => {
  const { stateId } = request.params;
  const getstateIdQuery = `
    SELECT
    SUM(cases) AS totalCases,
    SUM(cured) AS totalCured,
    SUM(active) AS totalActive,
    SUM(deaths) AS totalDeaths
    FROM
    district
    WHERE
    state_id = ${stateId}
    `;
  const responsestatearray = await db.get(getstateIdQuery);
  response.send(responsestatearray);
});

module.exports = app;
