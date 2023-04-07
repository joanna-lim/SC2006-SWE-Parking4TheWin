import json
import pyproj
import urllib.request

# (x, y) is also known as (easting, northing)
def svy21_to_wgs84(x, y):
    try:
        x, y = svy21_to_wgs84.transformer.transform(x, y)
    except AttributeError:
        svy21_to_wgs84.svy21 = pyproj.CRS.from_proj4("+proj=tmerc +lat_0=1.366666666666667 +lon_0=103.83333333333333 +k_0=1.0 +x_0=28001.642 +y_0=38744.572 +ellps=WGS84 +units=m +no_defs")
        svy21_to_wgs84.wgs84 = pyproj.CRS.from_proj4("+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs")
        svy21_to_wgs84.transformer = pyproj.Transformer.from_crs(svy21_to_wgs84.svy21, svy21_to_wgs84.wgs84)
        x, y = svy21_to_wgs84.transformer.transform(x, y)
    return y, x
    
# Format the carpark information to match the database
def format_carpark_information(record):
    fattributes = list()
    fattributes.append(record[1])
    fattributes.append(float(record[2]))
    fattributes.append(float(record[3]))
    fattributes.append(record[4])
    fattributes.append(record[5])
    fattributes.append(record[6])
    fattributes.append(record[7])

    np = record[8]
    if np == "YES":
        fattributes.append(True)
    elif np == "NO":
        fattributes.append(False)
    else:
        print("Error")
        return None

    fattributes.append(int(record[9]))
    fattributes.append(float(record[10]))

    cpb = record[11]
    if cpb == "Y":
        fattributes.append(True)
    elif cpb == "N":
        fattributes.append(False)
    else:
        print("Error")
        return None
    
    return fattributes

# HDB carpark information mainly consists of information that changes rarely
# We will only need to update everytime the webapp is started
def update_carparks():
    print("XXXXX Updating carparks XXXXXXXXXXXXXXXXXX")
    from . import db
    from .models import CarPark
    import csv

    records = list()
    with open('./website/hdb-carpark-information.csv', newline='') as csvfile:
        reader = csv.reader(csvfile, delimiter=',', quotechar='"')
        for row in reader:
            records.append(row)

    for record in records:
        carpark = CarPark.query.get(record[0])

        # Will only create and fill the database if it hasn't been created yet, won't update
        # May need to delete and run main.py again if you wan to update
        if not carpark:
            fattributes = format_carpark_information(record)
            lat, lon = svy21_to_wgs84(fattributes[1], fattributes[2])
            carpark = CarPark(
                car_park_no = record[0],
                address = fattributes[0],
                x_coord = fattributes[1],
                y_coord = fattributes[2],
                latitude = lat,
                longitude = lon,
                car_park_type  = fattributes[3],
                type_of_parking_system = fattributes[4],
                short_term_parking = fattributes[5],
                free_parking = fattributes[6],
                night_parking = fattributes[7],
                car_park_decks = fattributes[8],
                gantry_height = fattributes[9],
                car_park_basement = fattributes[10],
                # attributes below are not in the dataset being queried
                total_lots = None,
                lots_available = None,
                lot_type = None,
                lot_info_last_updated = None,
                no_of_interested_drivers = 0
            )
            db.session.add(carpark)
    
    db.session.commit()

def generate_geojson():
    from . import db
    from .models import CarPark
    import os
    print("XXXXX Generating GeoJSON XXXXXXXXXXXXXXXXX")
    carparks = CarPark.query.all()
    features = []
    for carpark in carparks:
        if carpark.lots_available is None or carpark.total_lots is None or carpark.total_lots==0:
            continue
        feature = {
                'coordinates': [carpark.longitude, carpark.latitude],
                'car_park_no': carpark.car_park_no,
                'address': carpark.address,
                'total_lots': carpark.total_lots,
                'lots_available': carpark.lots_available,
                'vacancy_percentage': int((carpark.lots_available/carpark.total_lots)*100),
                'car_park_type': carpark.car_park_type,
                'type_of_parking_system': carpark.type_of_parking_system,
                'free_parking': carpark.free_parking,
                'no_of_interested_drivers': carpark.no_of_interested_drivers
        }
        features.append(feature)
    geojson = features

    json_str = json.dumps(geojson)
    with open(os.path.join('website', 'carparks.json'), 'w') as f:
        f.write(json_str)
    abs_path = os.path.abspath('carparks.json')
    print(f"GeoJSON file saved to: {abs_path}")

def update_carparks_availability():
    print("XXXXX Updating carparks availability XXXXX")
    from . import db
    from .models import CarPark

    url = 'https://api.data.gov.sg/v1/transport/carpark-availability'

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }

    req = urllib.request.Request(url, headers=headers)
    fileobj = urllib.request.urlopen(req)
    json_data = json.load(fileobj)

    records = json_data['items'][0]['carpark_data']

    for record in records:
        carpark_info = record.get("carpark_info")[0]

        total_lots = int(carpark_info.get("total_lots"))
        lots_available = int(carpark_info.get("lots_available"))
        lot_type = carpark_info.get("lot_type")
        lot_info_last_updated = record.get("update_datetime")

        carpark = CarPark.query.get(record.get("carpark_number"))

        # update availability if the carpark exists in the database
        # otherwise, omit
        if carpark:
            carpark.total_lots = total_lots
            carpark.lots_available = lots_available
            carpark.lot_type = lot_type
            carpark.lot_info_last_updated = lot_info_last_updated

    db.session.commit()