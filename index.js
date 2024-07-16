const express = require('express');
const bodyParser = require('body-parser');
const xml2js = require('xml2js');

const app = express();
const testUsername = 'testuser';
const testPassword = 'testpassword';
const testHotelCode = '7294';
app.use(bodyParser.text({ type: 'application/xml' }));

// Middleware to parse SOAP messages
app.use((req, res, next) => {
  if (req.headers['content-type'] === 'application/xml') {
    xml2js.parseString(req.body, { explicitArray: false }, (err, result) => {
      if (err) {
        return res.status(400).send('Invalid XML');
      }
      req.body = result;
      next();
    });
  } else {
    next();
  }
});

function generateErrorResponse(errorCode, errorDescription) {
  return `
      <soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/">
          <soap-env:Body xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/">
              <OTA_HotelResNotifRS xmlns="http://www.opentravel.org/OTA/2003/05" Version="1.0" TimeStamp="${new Date().toISOString()}" EchoToken="abc123-unique">
                  <Errors>
                      <Error Type="6" Code="${errorCode}">${errorDescription}</Error>
                  </Errors>
              </OTA_HotelResNotifRS>
          </soap-env:Body>
      </soap-env:Envelope>`;
}

app.post('/api/reservation', (req, res) => {
  const body = req.body['soap-env:Envelope']['soap-env:Body'];
  const header = req.body['soap-env:Envelope']['soap-env:Header'];
  
  const username = header['wsse:Security']['wsse:UsernameToken']['wsse:Username'];
  const password = header['wsse:Security']['wsse:UsernameToken']['wsse:Password']['_'];

  if (username !== testUsername || password !== testPassword) {
    const errorResponse = generateErrorResponse(497, 'Invalid Username and/or Password');
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(200).send(errorResponse);
  }

  const hotelReservation = body['OTA_HotelResNotifRQ']['HotelReservations']['HotelReservation'];
  const hotelCode = hotelReservation['ResGlobalInfo']['BasicPropertyInfo']['$']['HotelCode'];

  if (hotelCode !== testHotelCode) {
    const errorResponse = generateErrorResponse(392, `Hotel not found for HotelCode=${hotelCode}`);
    return res.status(200).type('application/xml').send(errorResponse);
  }

  res.set('Content-Type', 'application/xml');
  res.send(generateSuccessResponse());
});

function generateSuccessResponse() {
  return `
        <soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/">
            <soap-env:Body xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/">
                <OTA_HotelResNotifRS xmlns="http://www.opentravel.org/OTA/2003/05" Version="1.0" TimeStamp="${new Date().toISOString()}" EchoToken="unique-token">
                    <Success/>
                </OTA_HotelResNotifRS>
            </soap-env:Body>
        </soap-env:Envelope>
    `;
}

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
