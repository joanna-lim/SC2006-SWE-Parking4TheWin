from flask import Blueprint, render_template, request, flash, jsonify
from flask_login import login_required, current_user
from . import db
from .auth import role_required
from functools import wraps
from .models import *
from datetime import datetime
import json
import os
import requests

MAPBOX_SECRET_KEY=os.getenv("MAPBOX_SECRET_KEY")

views = Blueprint('views', __name__)

# driver views here
@views.route('/', methods=['GET', 'POST'])
@role_required('driver')
def home():
    carparks = CarPark.query.all()
    features = []
    i = 0
    for carpark in carparks:
        i +=1
        api_endpoint = 'https://developers.onemap.sg/commonapi/convert/3414to4326?X=' + str(carpark.x_coord) + '&Y=' + str(carpark.y_coord)
        response = requests.get(api_endpoint)
        wgs84_latitude = response.json()['latitude']
        wgs84_longitude = response.json()['longitude']
        feature = {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': [wgs84_longitude, wgs84_latitude]
            },
            'properties': {
                'address': carpark.address
            }
        }
        features.append(feature)
        if i==25:
            break

    geojson = {
        'type': 'FeatureCollection',
        'features': features
    }
    json_str = json.dumps(geojson)
    with open('carparks.geojson', 'w') as f:
        f.write(json_str)
    abs_path = os.path.abspath('carparks.geojson')
    print(f"GeoJSON file saved to: {abs_path}")

    return render_template("home.html", user=current_user, MAPBOX_SECRET_KEY=MAPBOX_SECRET_KEY)

@views.route('/coe-registration', methods=['GET', 'POST'])
@role_required('driver')
def coe_registration():
    if request.method == "POST":
        full_name = request.form.get('fullName')
        car_plate = request.form.get('carPlate')
        coe_expiry_html = request.form.get('coeExpiry')
        coe_expiry = datetime.strptime(coe_expiry_html, '%Y-%m-%d').date()
        new_vehicle = Vehicle(full_name=full_name, car_plate=car_plate, coe_expiry=coe_expiry, user_id=current_user.id)
        db.session.add(new_vehicle) 
        db.session.commit()
        return render_template("coe_registered.html", user=current_user)
    return render_template("coe_registration.html", user=current_user)

@views.route('/coe-registration', methods=['GET', 'POST'])
@role_required('driver')
def coe_registered():
    car = Vehicle.query.all()
    return render_template("coe_registered.html", user=current_user)

@views.route('/view-rewards', methods=['GET', 'POST'])
@role_required('driver')
def view_rewards():
    rewards = Reward.query.all()
    return render_template("view_rewards.html", user=current_user, rewards=rewards)

# corporate views here
@views.route('/rewards-creation', methods=['GET', 'POST'])
@role_required('corporate')
def rewards_creation():
    if request.method == "POST":
        reward_title = request.form.get('rewardTitle')
        reward_expiry_html = request.form.get('rewardExpiry')
        reward_details = request.form.get('rewardDetails')
        reward_expiry = datetime.strptime(reward_expiry_html, '%Y-%m-%d').date()
        new_reward = Reward(reward_title=reward_title, reward_expiry=reward_expiry, reward_details=reward_details, user_id= current_user.id)
        db.session.add(new_reward) 
        db.session.commit()
    return render_template("rewards_creation.html", user=current_user)
