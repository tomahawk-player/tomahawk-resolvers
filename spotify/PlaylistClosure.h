/* === This file is part of Tomahawk Player - <http://tomahawk-player.org> ===
 *
 *   Copyright 2011, David Sansome <me@davidsansome.com>
 *   Copyright 2012, Leo Franchi <lfranchi@kde.org>
 *
 *   Inspired by Clementine's Closure class
 *
 *   Tomahawk is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   Tomahawk is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with Tomahawk. If not, see <http://www.gnu.org/licenses/>.
 */

#ifndef PLAYLISTCLOSURE_H
#define PLAYLISTCLOSURE_H

#include <libspotify/api.h>

#include <QObject>
#include <QList>
#include <QMetaMethod>

#include <tr1/functional.hpp>

#include <boost/noncopyable.hpp>
#include <boost/scoped_ptr.hpp>

/** Use this if the following is true:
 *
 * 1) You are doing an operation on a playlist
 * 2) Some sp_track* that you need to operate on hasn't loaded yet
 * 3) You need to re-do your operation whenever it has been loaded
 */

typedef std::tr1::function<bool ()> LoadedCondition;

class ClosureArgumentWrapper {
public:
    virtual ~ClosureArgumentWrapper() {}

    virtual QGenericArgument arg() const = 0;
};

template<typename T>
class ClosureArgument : public ClosureArgumentWrapper {
public:
    explicit ClosureArgument(const T& data) : data_(data) {}

    virtual QGenericArgument arg() const {
            return QArgument<T>(QMetaType::typeName(qMetaTypeId<T>()), data_);
    }

private:
    T data_;
};


class PlaylistClosure : boost::noncopyable
{
public:
    PlaylistClosure(LoadedCondition condition,
            QObject* receiver, const char* slot,
            const ClosureArgumentWrapper* val0 = 0,
            const ClosureArgumentWrapper* val1 = 0,
            const ClosureArgumentWrapper* val2 = 0);

    virtual ~PlaylistClosure() {}

    bool conditionSatisfied() const;

    void invoke();

private:
    QObject* receiver_;
    QMetaMethod slot_;
    LoadedCondition condition_;

    boost::scoped_ptr<const ClosureArgumentWrapper> val0_;
    boost::scoped_ptr<const ClosureArgumentWrapper> val1_;
    boost::scoped_ptr<const ClosureArgumentWrapper> val2_;
};


#define C_ARG(type, data) new ClosureArgument< type >(data)


template <typename T>
PlaylistClosure* NewPlaylistClosure(LoadedCondition checker,
                                             QObject* receiver,
                                             const char* slot,
                                             const T& val0) {
    return new PlaylistClosure(
                checker, receiver, slot,
                C_ARG(T, val0));
}

template <typename T0, typename T1>
PlaylistClosure* NewPlaylistClosure(
        LoadedCondition checker,
        QObject* receiver,
        const char* slot,
        const T0& val0,
        const T1& val1) {
    return new PlaylistClosure(
                checker, receiver, slot,
                C_ARG(T0, val0), C_ARG(T1, val1));
}

template <typename T0, typename T1, typename T2>
PlaylistClosure* NewPlaylistClosure(
        LoadedCondition checker,
        QObject* receiver,
        const char* slot,
        const T0& val0,
        const T1& val1,
        const T2& val2) {
    return new PlaylistClosure(
                checker, receiver, slot,
                C_ARG(T0, val0), C_ARG(T1, val1), C_ARG(T2, val2));
}


#endif // PLAYLISTCLOSURE_H